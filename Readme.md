# PQXDH Demo on XIAO ESP32-C3

A physical demonstration of Signal's Post-Quantum Extended Diffie-Hellman (PQXDH)
key agreement protocol running between two Seeed Studio XIAO ESP32-C3 boards over
ESP-NOW. Touching a capacitive sensor on Alice triggers an encrypted "ping" to
Bob, flashes the LED, and prints the full handshake trace over USB serial.

This README is written for Claude Code picking up the project. It contains the
complete design decisions already made, what's been built, what's left, and the
specific landmines to watch for.

---

## Demo goal

On-stage narrative: Alice (on battery) and Bob (tethered via USB to a MacBook Pro)
are two people trying to have a private conversation. A quantum adversary is
recording everything. The demo shows:

1. Boot — both boards show idle LED pattern (slow white pulse).
2. Bob broadcasts his prekey bundle over ESP-NOW.
3. Alice receives it, runs PQXDH (X25519 + ML-KEM-768 hybrid), derives a shared
   key `SK`, sends an AEAD-encrypted initial message. LEDs on both boards pulse
   blue during the handshake (~100–500ms).
4. Handshake complete — LEDs go solid green.
5. Presenter touches the capacitive sensor on Alice. Alice's LED flashes purple,
   Alice encrypts a "ping" under `SK` and sends it. Bob decrypts, flashes purple,
   sends "pong" back. Each touch = one round trip.
6. All log output — from both boards — appears on the Mac serial monitor in a
   single interleaved, color-coded stream. Alice's logs are relayed over
   ESP-NOW to Bob, who prints everything out over USB.

Secondary narrative (the "classical vs hybrid" toggle): a second button or
double-tap flips a mode flag. In classical mode the handshake runs X25519-only
(no ML-KEM encapsulation, DH-only KDF). The log prints a cheeky
`[EVE] recorded handshake, will decrypt in 2034` line to make the
harvest-now-decrypt-later threat concrete for a non-crypto audience.

---

## Hardware

- **2× Seeed Studio XIAO ESP32-C3** — RISC-V (riscv32imc-unknown-none-elf),
  160 MHz, 400 KB SRAM, 4 MB flash, integrated WiFi. No Bluetooth classic, BLE
  only. **Critically: no capacitive touch peripheral** — the ESP32 touch
  hardware is only on the original ESP32 and some S-series chips, NOT the C3.
- **Capacitive touch sensor** — digital HIGH/LOW on a GPIO pin (e.g. TTP223 or
  similar dedicated touch IC). Wire to any free GPIO on Alice; poll with
  debounce. Confirm pinout in `alice/src/main.rs` once the exact sensor model
  is known.
- **LED** — the XIAO ESP32-C3's onboard user LED (single color, on GPIO). Color
  is expressed via blink pattern rather than hue:
    - Idle: slow pulse (1 Hz, ~20% duty)
    - Handshaking: fast pulse (8 Hz, 50% duty)
    - Established: solid on
    - Touch triggered: 3 rapid blinks (20 Hz for ~200ms) then back to solid
    - Error: SOS pattern (···–––···)
- **Power** — Bob is USB-tethered to the MacBook. Alice is on battery (LiPo
  via the XIAO's battery pads, or USB power bank).

---

## Transport and logging architecture

- **ESP-NOW** — peer-to-peer, no WiFi AP required, 250-byte max payload per
  frame. ML-KEM-768 public keys (1184 B) and ciphertexts (1088 B) must be
  fragmented. This is handled by `shared/src/frame.rs` (to be written).
- **Single serial port** — only Bob is tethered. Alice **must** relay its log
  lines to Bob over ESP-NOW using a dedicated `LogRelay` message type. Bob
  forwards both its own logs and Alice's relayed logs over USB with a
  prefix tag (`[ALICE]` / `[BOB]`) so the TypeScript viewer on the Mac can
  color-code by source.
- **Log levels** — info (default), debug (hex dumps of key material prefixes
  only — never full keys), error. Gate debug behind a feature flag or runtime
  switch so the demo output stays readable.

---

## Current repository state

```
firmware/
├── Cargo.toml            DONE — workspace with ml-kem, x25519-dalek, ed25519-dalek,
│                              hkdf, sha2, chacha20poly1305, heapless, zeroize
└── shared/
    ├── Cargo.toml        DONE — no_std library crate with host-test support
    └── src/
        ├── lib.rs        DONE — re-exports
        └── pqxdh.rs      DONE — full PQXDH state machine + tests (UNVERIFIED,
                               see "Verify the core first" below)
```

Still to build:

```
firmware/
├── shared/src/
│   ├── wire.rs           Flat-byte (de)serialization of PrekeyBundle, InitialMessage,
│   │                     session messages, and LogRelay frames. No serde; write by
│   │                     hand with bounded heapless::Vec buffers.
│   └── frame.rs          ESP-NOW fragmentation layer. Header:
│                           [msg_type: u8][msg_id: u16][frag_idx: u8][frag_total: u8]
│                           [len: u16][payload ≤ 242 B]
│                         Reassembly buffer keyed on (peer MAC, msg_id); timeout
│                         after 2s; bounded to 2 in-flight messages per peer.
├── alice/                New bin crate. esp-hal + esp-hal-embassy + esp-wifi ESP-NOW.
│   └── src/main.rs       Runs AliceIdentity, sends InitialMessage on button press,
│                         forwards all local logs as LogRelay messages.
├── bob/                  New bin crate. Same stack as Alice.
│   └── src/main.rs       Runs BobIdentity, broadcasts prekey bundle periodically,
│                         responds to InitialMessage, prints both own logs and
│                         relayed LogRelay frames over USB serial.
└── viewer/               Separate TypeScript project (not in the Cargo workspace).
    ├── package.json      deps: serialport, chalk (or picocolors)
    ├── tsconfig.json
    └── src/index.ts      Reads one serial port, parses [ALICE] / [BOB] prefix,
                          color-codes, timestamps, prints to stdout.
```

---

## Verify the core first (IMPORTANT)

The `shared/src/pqxdh.rs` was written without a compiler loop — the sandbox had
no Rust toolchain. Before doing anything else:

```bash
cd firmware
cargo test -p pqxdh-shared
```

Expected tests: `full_handshake_roundtrip`, `tampered_spk_signature_rejected`,
`tampered_pq_ek_signature_rejected`, `swapped_ct_fails_to_decrypt`. All four
should pass.

**Likely compilation issues** (all fixable in 1–2 lines each):

1. **`ml-kem` 0.2 API** — `MlKem768::generate(rng)` return tuple order may be
   `(EncapsulationKey, DecapsulationKey)` rather than the `(dk, ek)` I wrote.
   Compiler error will say so immediately.
2. **`EncapsulationKey::from_bytes`** — input type is
   `&Array<u8, U1184>`; if `.into()` doesn't coerce from `[u8; 1184]`, use
   `ml_kem::Encoded::<_>::try_from(&bundle.pq_ek[..])` or the explicit
   `GenericArray::from_slice`.
3. **`SharedSecret::as_slice()`** — in ml-kem 0.2 the shared secret is a
   `Array<u8, U32>`. Try `.as_slice()` first, fall back to `.as_ref()`.
4. **`x25519-dalek` `SharedSecret::zeroize`** — the 2.x crate zeroizes on `Drop`
   in recent versions. If this is missing on the pinned version, drop the
   locals explicitly or bump the version.
5. **`ed25519-dalek` `no_std`** — the code uses `.sign()` and `.verify(msg, sig)`
   (non-prehashed). These should work with `default-features = false` +
   `zeroize` feature enabled. If feature resolution fails, add the `rand_core`
   feature explicitly.

**Do not re-design the protocol to work around compilation errors.** The shape
is correct per the Signal PQXDH spec. Fix API mismatches in place.

---

## The PQXDH protocol as implemented

Simplifications from real Signal (document these in the demo talk):

1. **Ed25519 identity signing key**, separate from the X25519 identity key.
   Real Signal uses XEdDSA to sign with an X25519 key directly. We split them
   to avoid pulling in a XEdDSA implementation. Security of the shared-secret
   derivation is unaffected.
2. **No Double Ratchet, no SPQR.** After the handshake we use `SK` directly
   with ChaCha20-Poly1305 and a strictly-increasing counter nonce. Real Signal
   rotates keys per message via the Double Ratchet (and SPQR for post-quantum
   forward secrecy on the ratchet itself). We call this out explicitly as
   "the interesting part is the handshake; the ratchet is out of scope."
3. **No identity authentication** — Bob signs his prekeys with `IK_B`, but we
   don't verify `IK_B` against a trusted key store. A real deployment pins
   identity keys via out-of-band verification (safety numbers). Flag this in
   the talk.

Protocol flow:

**Bob generates** on boot:
- Ed25519 signing keypair (identity auth)
- X25519 identity keypair `IK_B` (used in DH1, DH2)
- X25519 signed prekey `SPK_B` + signature under `id_sign` (used in DH1, DH3)
- ML-KEM-768 keypair `(PQPK_B, pq_dk_B)` + signature on `PQPK_B` (used for KEM)
- X25519 one-time prekey `OPK_B` (used in DH4, dropped after use)

**Bob broadcasts** `PrekeyBundle`: `{id_verify, id_x_pub, spk_pub, spk_sig,
pq_ek, pq_sig, opk_pub}`.

**Alice receives bundle and:**
- Verifies `spk_sig` and `pq_sig` under `id_verify`. Reject on failure.
- Encapsulates to `pq_ek`: `(CT, SS) = ML-KEM-Encap(pq_ek)`.
- Generates fresh ephemeral `EK_A`.
- Computes:
  - `DH1 = X25519(IK_A, SPK_B)`
  - `DH2 = X25519(EK_A, IK_B)`
  - `DH3 = X25519(EK_A, SPK_B)`
  - `DH4 = X25519(EK_A, OPK_B)` (if OPK present)
- Derives `SK = HKDF-SHA256(salt=0^32, ikm=F || DH1 || DH2 || DH3 || [DH4] || SS, info=KDF_INFO)`
  where `F = 0xFF × 32` is Signal's domain-separation prefix.
- Encrypts initial payload under `SK` with ChaCha20-Poly1305, nonce counter 0,
  AAD = `b"PQXDH-initial"`.

**Alice sends** `InitialMessage`: `{ik_a_pub, ek_a_pub, pq_ct, used_opk, ciphertext, tag}`.

**Bob receives and:**
- Decapsulates `pq_ct` with `pq_dk_B` → recovers `SS`.
- Computes mirror DHs with his private keys vs. Alice's public keys.
- Derives the same `SK`.
- Decrypts the initial payload. On success, session is established.
- Consumes `OPK_B` — a real deployment drops the one-time key and requests
  a new one from the server; our demo just sets `self.opk = None`.

Post-handshake messages use `SK` directly with ChaCha20-Poly1305, counter
nonces, and AAD `b"A->B"` / `b"B->A"` for direction separation.

---

## Classical-only mode

For the toggle, add a `HandshakeMode` enum:

```rust
pub enum HandshakeMode { Hybrid, ClassicalOnly }
```

In classical mode:
- Bob's bundle still includes `pq_ek` and `pq_sig` for wire compatibility, but
  a `mode` byte in the `InitialMessage` tells Bob to skip decapsulation.
- Alice skips `ML-KEM-Encap`. `SS` is omitted from the KDF IKM entirely
  (not replaced with zeros — omission makes the domain separation cleaner and
  matches what X3DH actually does).
- Log an `[EVE]` line after handshake completion in classical mode.

Keep the two modes sharing as much code as possible — a single boolean branch
around the KEM operations, not a forked state machine.

---

## Firmware target and toolchain

- **Target**: `riscv32imc-unknown-none-elf`
- **Rust toolchain**: stable should work; if `esp-hal` requires nightly for a
  specific feature, a `rust-toolchain.toml` in the firmware root pins it.
- **Flashing**: `espflash` or `cargo-espflash`.
- **Stack**: `esp-hal` + `esp-hal-embassy` (async runtime) + `esp-wifi`
  (ESP-NOW requires the WiFi driver even though we don't join an AP).
- **Logging**: `esp-println` with the `uart` feature for USB-CDC output on Bob.
  On Alice, local logs go through a macro that routes to either `esp-println`
  (debug builds) OR the `LogRelay` ESP-NOW frame (release demo builds).

Memory sanity check: ML-KEM-768 on this class of chip uses roughly 10–15 KB of
stack for keygen/encaps/decaps with the RustCrypto implementation. With the
WiFi stack allocating ~50 KB, the Embassy executor taking a few KB, and the
app state under 10 KB, there's comfortable headroom in the 400 KB SRAM.
Runtime of each KEM op on 160 MHz RISC-V is roughly 15–40 ms — invisible to
the audience.

---

## Ordering of remaining work

1. **Verify `shared/`** — run the host tests, fix any API mismatches.
2. **`shared/src/wire.rs`** — serialize the types. Keep it dumb and bounded;
   every `encode` returns `heapless::Vec<u8, N>` with `N` sized for the worst
   case. Every `decode` takes `&[u8]` and returns `Result<Self, Error>`.
3. **`shared/src/frame.rs`** — fragmentation. Unit-test reassembly with
   out-of-order fragments, duplicate fragments, and the 2-second timeout.
4. **`bob/` binary** — simpler of the two, no button logic. Get ESP-NOW
   broadcast + USB serial log working first, then add handshake handling.
5. **`alice/` binary** — add button polling (debounce: require 3 consecutive
   HIGH reads at 10 ms apart), LED pattern task, handshake initiation on first
   button press after boot, post-handshake ping on subsequent presses.
6. **`viewer/`** — TypeScript serial reader. ~80 lines. Reads Bob's USB port,
   splits on `[ALICE]` / `[BOB]` prefix, colorizes.
7. **Classical-only toggle** — last, once the hybrid path works end-to-end.

---

## Landmines, in order of likelihood

- **ml-kem API drift** between crate versions — see "Verify the core first."
- **ESP-NOW initialization ordering** — `esp-wifi` must be initialized before
  ESP-NOW, and the WiFi driver needs its own memory pool (`heap_caps_malloc`).
  Follow the current `esp-wifi` example for ESP-NOW peer-to-peer; the API has
  shifted across `esp-hal` versions. Pin the versions in Cargo.toml once a
  working combination is found.
- **MAC addresses for ESP-NOW** — broadcast MAC `FF:FF:FF:FF:FF:FF` works
  without pairing but means both boards receive their own broadcasts. Filter
  on own MAC in the receive handler, or pair explicitly using each board's
  MAC printed over serial on boot.
- **Fragment reassembly DoS** — a peer could flood fragments with different
  `msg_id` values. Bound the reassembly table (e.g., 2 concurrent messages
  per peer) and drop oldest on overflow.
- **Button debounce on Alice** — a bare touch IC's output is often noisy on
  edges. Debounce in software; don't trigger on every rising edge.
- **LiPo battery brownout on Alice during KEM op** — ML-KEM + radio TX can
  spike current. If Alice resets mid-handshake, add a bulk cap near the
  XIAO's battery input or use a higher-capacity cell.
- **Never print raw key material** — log key hashes (first 8 bytes of
  SHA-256) or 8-byte prefixes. Full keys on a projector is a footgun even
  for a demo.

---

## Running tests

Host tests on the shared crate:

```bash
cd firmware
cargo test -p pqxdh-shared
```

Host test ideas not yet written:
- Wire format round-trip: `encode(x) → decode → x` for every message type.
- Fragment reassembly with random-order delivery.
- Classical vs hybrid mode produces different `SK` for same inputs.

---

## Useful references

- Signal PQXDH spec: https://signal.org/docs/specifications/pqxdh/
- Signal Triple Ratchet / SPQR blog post: https://signal.org/blog/spqr/
- RustCrypto ml-kem: https://github.com/RustCrypto/KEMs/tree/master/ml-kem
- esp-hal examples for ESP-NOW: https://github.com/esp-rs/esp-hal/tree/main/examples
- XIAO ESP32-C3 pinout: https://wiki.seeedstudio.com/XIAO_ESP32C3_Getting_Started/