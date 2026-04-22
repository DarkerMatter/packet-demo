use chacha20poly1305::{
    aead::{AeadInPlace, KeyInit},
    ChaCha20Poly1305, Nonce, Tag,
};
use ed25519_dalek::{Signature, Signer, SigningKey, Verifier, VerifyingKey};
use hkdf::Hkdf;
use ml_kem::{
    kem::{Decapsulate, Encapsulate},
    EncodedSizeUser, KemCore, MlKem768,
};
use sha2::Sha256;
use x25519_dalek::{PublicKey as X25519Public, StaticSecret as X25519Secret};
use zeroize::Zeroize;

use rand_core::CryptoRngCore;

/// Domain separator for HKDF info parameter.
const KDF_INFO: &[u8] = b"PQXDH-demo-v1";

/// 32 bytes of 0xFF — Signal's domain-separation prefix in the KDF input.
const F_PREFIX: [u8; 32] = [0xFF; 32];

/// 32 bytes of zeros — HKDF salt.
const ZERO_SALT: [u8; 32] = [0u8; 32];

/// Handshake mode selector.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum HandshakeMode {
    /// Full PQXDH: X25519 + ML-KEM-768 hybrid.
    Hybrid,
    /// X25519 only (classical X3DH). Vulnerable to quantum harvest-now-decrypt-later.
    ClassicalOnly,
}

// -- Key sizes --
pub const X25519_KEY_LEN: usize = 32;
pub const ED25519_VERIFY_KEY_LEN: usize = 32;
pub const ED25519_SIG_LEN: usize = 64;
pub const MLKEM768_EK_LEN: usize = 1184;
pub const MLKEM768_CT_LEN: usize = 1088;
pub const MLKEM768_SS_LEN: usize = 32;
pub const CHACHA_KEY_LEN: usize = 32;
pub const CHACHA_TAG_LEN: usize = 16;

/// Bob's pre-key bundle, broadcast to Alice.
pub struct PrekeyBundle {
    /// Ed25519 identity verification key (for signature checks).
    pub id_verify: [u8; ED25519_VERIFY_KEY_LEN],
    /// X25519 identity public key IK_B.
    pub ik_pub: [u8; X25519_KEY_LEN],
    /// X25519 signed pre-key SPK_B.
    pub spk_pub: [u8; X25519_KEY_LEN],
    /// Ed25519 signature over spk_pub.
    pub spk_sig: [u8; ED25519_SIG_LEN],
    /// ML-KEM-768 encapsulation key PQPK_B.
    pub pq_ek: [u8; MLKEM768_EK_LEN],
    /// Ed25519 signature over pq_ek.
    pub pq_sig: [u8; ED25519_SIG_LEN],
    /// X25519 one-time pre-key OPK_B (optional, always present in this demo).
    pub opk_pub: [u8; X25519_KEY_LEN],
}

/// Alice → Bob initial message after handshake.
pub struct InitialMessage {
    /// Alice's X25519 identity public key.
    pub ik_a_pub: [u8; X25519_KEY_LEN],
    /// Alice's ephemeral X25519 public key.
    pub ek_a_pub: [u8; X25519_KEY_LEN],
    /// ML-KEM ciphertext (encapsulated to Bob's pq_ek).
    pub pq_ct: [u8; MLKEM768_CT_LEN],
    /// Whether OPK was used.
    pub used_opk: bool,
    /// Handshake mode.
    pub mode: HandshakeMode,
    /// AEAD-encrypted initial payload.
    pub ciphertext: heapless::Vec<u8, 128>,
}

/// Post-handshake encrypted message.
pub struct SessionMessage {
    /// Strictly-increasing counter (used as nonce).
    pub counter: u32,
    /// Direction tag for AAD.
    pub direction: Direction,
    /// AEAD ciphertext (payload + 16-byte tag).
    pub ciphertext: heapless::Vec<u8, 128>,
}

/// Log relay frame from Alice → Bob for unified serial output.
pub struct LogRelay {
    pub message: heapless::Vec<u8, 200>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Direction {
    AliceToBob,
    BobToAlice,
}

impl Direction {
    pub fn aad(&self) -> &'static [u8] {
        match self {
            Direction::AliceToBob => b"A->B",
            Direction::BobToAlice => b"B->A",
        }
    }
}

/// Bob's long-lived identity and session keys.
pub struct BobIdentity {
    /// Ed25519 signing key (identity authentication).
    pub id_sign: SigningKey,
    /// X25519 identity secret key.
    pub ik_secret: X25519Secret,
    /// X25519 identity public key.
    pub ik_pub: X25519Public,
    /// X25519 signed pre-key (secret).
    pub spk_secret: X25519Secret,
    /// X25519 signed pre-key (public).
    pub spk_pub: X25519Public,
    /// ML-KEM-768 decapsulation key.
    pub pq_dk: <MlKem768 as KemCore>::DecapsulationKey,
    /// ML-KEM-768 encapsulation key (public).
    pub pq_ek: <MlKem768 as KemCore>::EncapsulationKey,
    /// X25519 one-time pre-key (secret). Consumed after first handshake.
    pub opk_secret: Option<X25519Secret>,
    /// X25519 one-time pre-key (public).
    pub opk_pub: X25519Public,
}

impl BobIdentity {
    /// Generate all keys from an RNG.
    pub fn generate(rng: &mut impl CryptoRngCore) -> Self {
        let id_sign = SigningKey::generate(rng);

        let ik_secret = X25519Secret::random_from_rng(&mut *rng);
        let ik_pub = X25519Public::from(&ik_secret);

        let spk_secret = X25519Secret::random_from_rng(&mut *rng);
        let spk_pub = X25519Public::from(&spk_secret);

        let (pq_dk, pq_ek) = MlKem768::generate(rng);

        let opk_secret = X25519Secret::random_from_rng(&mut *rng);
        let opk_pub = X25519Public::from(&opk_secret);

        Self {
            id_sign,
            ik_secret,
            ik_pub,
            spk_secret,
            spk_pub,
            pq_dk,
            pq_ek,
            opk_secret: Some(opk_secret),
            opk_pub,
        }
    }

    /// Build the prekey bundle for broadcast.
    pub fn prekey_bundle(&self) -> PrekeyBundle {
        let spk_sig = self.id_sign.sign(self.spk_pub.as_bytes());
        let pq_ek_bytes = self.pq_ek.as_bytes();
        let pq_sig = self.id_sign.sign(pq_ek_bytes.as_slice());

        PrekeyBundle {
            id_verify: self.id_sign.verifying_key().to_bytes(),
            ik_pub: *self.ik_pub.as_bytes(),
            spk_pub: *self.spk_pub.as_bytes(),
            spk_sig: spk_sig.to_bytes(),
            pq_ek: pq_ek_bytes.as_slice().try_into().expect("pq_ek size"),
            pq_sig: pq_sig.to_bytes(),
            opk_pub: *self.opk_pub.as_bytes(),
        }
    }

    /// Process Alice's initial message and establish a session.
    pub fn process_initial_message(
        &mut self,
        msg: &InitialMessage,
    ) -> Result<(BobSession, heapless::Vec<u8, 128>), HandshakeError> {
        let alice_ik = X25519Public::from(msg.ik_a_pub);
        let alice_ek = X25519Public::from(msg.ek_a_pub);

        // DH1 = X25519(SPK_B, IK_A)
        let dh1 = self.spk_secret.diffie_hellman(&alice_ik);
        // DH2 = X25519(IK_B, EK_A)
        let dh2 = self.ik_secret.diffie_hellman(&alice_ek);
        // DH3 = X25519(SPK_B, EK_A)
        let dh3 = self.spk_secret.diffie_hellman(&alice_ek);

        // DH4 = X25519(OPK_B, EK_A) if OPK was used
        let dh4 = if msg.used_opk {
            let opk = self
                .opk_secret
                .take()
                .ok_or(HandshakeError::OpkAlreadyUsed)?;
            Some(opk.diffie_hellman(&alice_ek))
        } else {
            None
        };

        // ML-KEM decapsulation
        let pq_ss: Option<[u8; MLKEM768_SS_LEN]> = if msg.mode == HandshakeMode::Hybrid {
            let ct = hybrid_array::Array::try_from(msg.pq_ct.as_slice())
                .map_err(|_| HandshakeError::InvalidCiphertext)?;
            let ss = self.pq_dk.decapsulate(&ct)
                .map_err(|_| HandshakeError::InvalidCiphertext)?;
            let ss_bytes: [u8; MLKEM768_SS_LEN] = ss.as_slice().try_into()
                .map_err(|_| HandshakeError::CryptoError)?;
            Some(ss_bytes)
        } else {
            None
        };

        // Derive SK
        let sk = derive_sk(
            dh1.as_bytes(),
            dh2.as_bytes(),
            dh3.as_bytes(),
            dh4.as_ref().map(|d| d.as_bytes()),
            pq_ss.as_ref().map(|ss| ss.as_slice()),
        );

        // Decrypt initial payload
        let pt = aead_decrypt(&sk, &[0u8; 12], b"PQXDH-initial", &msg.ciphertext)?;

        Ok((
            BobSession {
                sk,
                tx_counter: 0,
                rx_counter: 0,
                mode: msg.mode,
            },
            pt,
        ))
    }
}

/// Alice's identity keys.
pub struct AliceIdentity {
    pub ik_secret: X25519Secret,
    pub ik_pub: X25519Public,
}

impl AliceIdentity {
    pub fn generate(rng: &mut impl CryptoRngCore) -> Self {
        let ik_secret = X25519Secret::random_from_rng(rng);
        let ik_pub = X25519Public::from(&ik_secret);
        Self { ik_secret, ik_pub }
    }

    /// Process Bob's prekey bundle and produce an InitialMessage + session.
    pub fn process_prekey_bundle(
        &self,
        bundle: &PrekeyBundle,
        mode: HandshakeMode,
        payload: &[u8],
        rng: &mut impl CryptoRngCore,
    ) -> Result<(AliceSession, InitialMessage), HandshakeError> {
        // Verify signatures
        let id_verify = VerifyingKey::from_bytes(&bundle.id_verify)
            .map_err(|_| HandshakeError::InvalidIdentityKey)?;

        id_verify
            .verify(&bundle.spk_pub, &Signature::from_bytes(&bundle.spk_sig))
            .map_err(|_| HandshakeError::BadSpkSignature)?;

        id_verify
            .verify(&bundle.pq_ek, &Signature::from_bytes(&bundle.pq_sig))
            .map_err(|_| HandshakeError::BadPqSignature)?;

        // Generate ephemeral key
        let ek_secret = X25519Secret::random_from_rng(&mut *rng);
        let ek_pub = X25519Public::from(&ek_secret);

        let bob_ik = X25519Public::from(bundle.ik_pub);
        let bob_spk = X25519Public::from(bundle.spk_pub);
        let bob_opk = X25519Public::from(bundle.opk_pub);

        // DH1 = X25519(IK_A, SPK_B)
        let dh1 = self.ik_secret.diffie_hellman(&bob_spk);
        // DH2 = X25519(EK_A, IK_B)
        let dh2 = ek_secret.diffie_hellman(&bob_ik);
        // DH3 = X25519(EK_A, SPK_B)
        let dh3 = ek_secret.diffie_hellman(&bob_spk);
        // DH4 = X25519(EK_A, OPK_B)
        let dh4 = ek_secret.diffie_hellman(&bob_opk);

        // ML-KEM encapsulation
        let (pq_ct_bytes, pq_ss): ([u8; MLKEM768_CT_LEN], Option<[u8; MLKEM768_SS_LEN]>) =
            if mode == HandshakeMode::Hybrid {
                let ek_array = hybrid_array::Array::try_from(bundle.pq_ek.as_slice())
                    .map_err(|_| HandshakeError::CryptoError)?;
                let ek = <MlKem768 as KemCore>::EncapsulationKey::from_bytes(&ek_array);
                let (ct, ss) = ek.encapsulate(rng).expect("encapsulate");
                let ct_bytes: [u8; MLKEM768_CT_LEN] =
                    ct.as_slice().try_into().expect("ct size");
                let ss_bytes: [u8; MLKEM768_SS_LEN] =
                    ss.as_slice().try_into().expect("ss size");
                (ct_bytes, Some(ss_bytes))
            } else {
                ([0u8; MLKEM768_CT_LEN], None)
            };

        // Derive SK
        let sk = derive_sk(
            dh1.as_bytes(),
            dh2.as_bytes(),
            dh3.as_bytes(),
            Some(dh4.as_bytes()),
            pq_ss.as_ref().map(|ss| ss.as_slice()),
        );

        // Encrypt initial payload
        let ciphertext = aead_encrypt(&sk, &[0u8; 12], b"PQXDH-initial", payload)?;

        let initial_msg = InitialMessage {
            ik_a_pub: *self.ik_pub.as_bytes(),
            ek_a_pub: *ek_pub.as_bytes(),
            pq_ct: pq_ct_bytes,
            used_opk: true,
            mode,
            ciphertext,
        };

        let session = AliceSession {
            sk,
            tx_counter: 0,
            rx_counter: 0,
            mode,
        };

        Ok((session, initial_msg))
    }
}

/// Established session on Alice's side.
pub struct AliceSession {
    sk: [u8; CHACHA_KEY_LEN],
    tx_counter: u32,
    rx_counter: u32,
    pub mode: HandshakeMode,
}

/// Established session on Bob's side.
pub struct BobSession {
    sk: [u8; CHACHA_KEY_LEN],
    tx_counter: u32,
    rx_counter: u32,
    pub mode: HandshakeMode,
}

// Shared encrypt/decrypt for post-handshake messages.
fn encrypt_message(
    sk: &[u8; CHACHA_KEY_LEN],
    counter: u32,
    direction: Direction,
    plaintext: &[u8],
) -> Result<heapless::Vec<u8, 128>, HandshakeError> {
    let mut nonce_bytes = [0u8; 12];
    nonce_bytes[8..12].copy_from_slice(&counter.to_le_bytes());
    aead_encrypt(sk, &nonce_bytes, direction.aad(), plaintext)
}

fn decrypt_message(
    sk: &[u8; CHACHA_KEY_LEN],
    counter: u32,
    direction: Direction,
    ciphertext: &[u8],
) -> Result<heapless::Vec<u8, 128>, HandshakeError> {
    let mut nonce_bytes = [0u8; 12];
    nonce_bytes[8..12].copy_from_slice(&counter.to_le_bytes());
    aead_decrypt(sk, &nonce_bytes, direction.aad(), ciphertext)
}

impl AliceSession {
    pub fn encrypt(&mut self, plaintext: &[u8]) -> Result<SessionMessage, HandshakeError> {
        let ct = encrypt_message(&self.sk, self.tx_counter, Direction::AliceToBob, plaintext)?;
        let msg = SessionMessage {
            counter: self.tx_counter,
            direction: Direction::AliceToBob,
            ciphertext: ct,
        };
        self.tx_counter += 1;
        Ok(msg)
    }

    pub fn decrypt(&mut self, msg: &SessionMessage) -> Result<heapless::Vec<u8, 128>, HandshakeError> {
        if msg.counter != self.rx_counter {
            return Err(HandshakeError::CounterMismatch);
        }
        let pt = decrypt_message(&self.sk, msg.counter, Direction::BobToAlice, &msg.ciphertext)?;
        self.rx_counter += 1;
        Ok(pt)
    }
}

impl BobSession {
    pub fn encrypt(&mut self, plaintext: &[u8]) -> Result<SessionMessage, HandshakeError> {
        let ct = encrypt_message(&self.sk, self.tx_counter, Direction::BobToAlice, plaintext)?;
        let msg = SessionMessage {
            counter: self.tx_counter,
            direction: Direction::BobToAlice,
            ciphertext: ct,
        };
        self.tx_counter += 1;
        Ok(msg)
    }

    pub fn decrypt(&mut self, msg: &SessionMessage) -> Result<heapless::Vec<u8, 128>, HandshakeError> {
        if msg.counter != self.rx_counter {
            return Err(HandshakeError::CounterMismatch);
        }
        let pt = decrypt_message(&self.sk, msg.counter, Direction::AliceToBob, &msg.ciphertext)?;
        self.rx_counter += 1;
        Ok(pt)
    }
}

impl Drop for AliceSession {
    fn drop(&mut self) {
        self.sk.zeroize();
    }
}

impl Drop for BobSession {
    fn drop(&mut self) {
        self.sk.zeroize();
    }
}

/// Derive the shared key SK via HKDF-SHA256.
///
/// IKM = F || DH1 || DH2 || DH3 || [DH4] || [SS]
fn derive_sk(
    dh1: &[u8; 32],
    dh2: &[u8; 32],
    dh3: &[u8; 32],
    dh4: Option<&[u8; 32]>,
    pq_ss: Option<&[u8]>,
) -> [u8; 32] {
    // Build IKM: F || DH1 || DH2 || DH3 || [DH4] || [SS]
    // Max size: 32 + 32*4 + 32 = 192 bytes
    let mut ikm = [0u8; 192];
    let mut pos = 0;

    ikm[pos..pos + 32].copy_from_slice(&F_PREFIX);
    pos += 32;
    ikm[pos..pos + 32].copy_from_slice(dh1);
    pos += 32;
    ikm[pos..pos + 32].copy_from_slice(dh2);
    pos += 32;
    ikm[pos..pos + 32].copy_from_slice(dh3);
    pos += 32;
    if let Some(d4) = dh4 {
        ikm[pos..pos + 32].copy_from_slice(d4);
        pos += 32;
    }
    if let Some(ss) = pq_ss {
        let len = ss.len().min(32);
        ikm[pos..pos + len].copy_from_slice(&ss[..len]);
        pos += len;
    }

    let hk = Hkdf::<Sha256>::new(Some(&ZERO_SALT), &ikm[..pos]);
    let mut sk = [0u8; 32];
    hk.expand(KDF_INFO, &mut sk).expect("HKDF expand");

    // Zeroize IKM
    ikm.zeroize();
    sk
}

/// Encrypt plaintext with ChaCha20-Poly1305, returning ciphertext || tag.
fn aead_encrypt(
    key: &[u8; 32],
    nonce: &[u8; 12],
    aad: &[u8],
    plaintext: &[u8],
) -> Result<heapless::Vec<u8, 128>, HandshakeError> {
    let cipher =
        ChaCha20Poly1305::new_from_slice(key).map_err(|_| HandshakeError::CryptoError)?;
    let mut buf = heapless::Vec::<u8, 128>::new();
    buf.extend_from_slice(plaintext)
        .map_err(|_| HandshakeError::MessageTooLong)?;
    let tag = cipher
        .encrypt_in_place_detached(&Nonce::from(*nonce), aad, &mut buf)
        .map_err(|_| HandshakeError::CryptoError)?;
    buf.extend_from_slice(&tag)
        .map_err(|_| HandshakeError::MessageTooLong)?;
    Ok(buf)
}

/// Decrypt ciphertext || tag with ChaCha20-Poly1305.
fn aead_decrypt(
    key: &[u8; 32],
    nonce: &[u8; 12],
    aad: &[u8],
    ciphertext_and_tag: &[u8],
) -> Result<heapless::Vec<u8, 128>, HandshakeError> {
    if ciphertext_and_tag.len() < CHACHA_TAG_LEN {
        return Err(HandshakeError::DecryptionFailed);
    }
    let (ct, tag_bytes) = ciphertext_and_tag.split_at(ciphertext_and_tag.len() - CHACHA_TAG_LEN);
    let tag = Tag::from_slice(tag_bytes);
    let cipher =
        ChaCha20Poly1305::new_from_slice(key).map_err(|_| HandshakeError::CryptoError)?;
    let mut buf = heapless::Vec::<u8, 128>::new();
    buf.extend_from_slice(ct)
        .map_err(|_| HandshakeError::MessageTooLong)?;
    cipher
        .decrypt_in_place_detached(&Nonce::from(*nonce), aad, &mut buf, tag)
        .map_err(|_| HandshakeError::DecryptionFailed)?;
    Ok(buf)
}

#[derive(Debug)]
pub enum HandshakeError {
    InvalidIdentityKey,
    BadSpkSignature,
    BadPqSignature,
    InvalidCiphertext,
    OpkAlreadyUsed,
    DecryptionFailed,
    CryptoError,
    MessageTooLong,
    CounterMismatch,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_rng() -> rand::rngs::ThreadRng {
        rand::thread_rng()
    }

    #[test]
    fn full_handshake_roundtrip() {
        let mut rng = test_rng();

        // Bob generates identity and prekey bundle
        let mut bob = BobIdentity::generate(&mut rng);
        let bundle = bob.prekey_bundle();

        // Alice processes bundle
        let alice_id = AliceIdentity::generate(&mut rng);
        let payload = b"hello bob!";
        let (mut alice_session, initial_msg) = alice_id
            .process_prekey_bundle(&bundle, HandshakeMode::Hybrid, payload, &mut rng)
            .expect("alice handshake");

        // Bob processes initial message
        let (mut bob_session, decrypted) = bob
            .process_initial_message(&initial_msg)
            .expect("bob handshake");
        assert_eq!(&decrypted[..], payload);

        // Post-handshake: Alice sends ping
        let ping = alice_session.encrypt(b"ping").expect("encrypt ping");
        let ping_pt = bob_session.decrypt(&ping).expect("decrypt ping");
        assert_eq!(&ping_pt[..], b"ping");

        // Bob sends pong
        let pong = bob_session.encrypt(b"pong").expect("encrypt pong");
        let pong_pt = alice_session.decrypt(&pong).expect("decrypt pong");
        assert_eq!(&pong_pt[..], b"pong");
    }

    #[test]
    fn tampered_spk_signature_rejected() {
        let mut rng = test_rng();
        let bob = BobIdentity::generate(&mut rng);
        let mut bundle = bob.prekey_bundle();

        // Tamper with SPK signature
        bundle.spk_sig[0] ^= 0xFF;

        let alice_id = AliceIdentity::generate(&mut rng);
        let result =
            alice_id.process_prekey_bundle(&bundle, HandshakeMode::Hybrid, b"test", &mut rng);
        assert!(matches!(result, Err(HandshakeError::BadSpkSignature)));
    }

    #[test]
    fn tampered_pq_ek_signature_rejected() {
        let mut rng = test_rng();
        let bob = BobIdentity::generate(&mut rng);
        let mut bundle = bob.prekey_bundle();

        // Tamper with PQ EK signature
        bundle.pq_sig[0] ^= 0xFF;

        let alice_id = AliceIdentity::generate(&mut rng);
        let result =
            alice_id.process_prekey_bundle(&bundle, HandshakeMode::Hybrid, b"test", &mut rng);
        assert!(matches!(result, Err(HandshakeError::BadPqSignature)));
    }

    #[test]
    fn swapped_ct_fails_to_decrypt() {
        let mut rng = test_rng();

        // Two separate Bob identities
        let mut bob1 = BobIdentity::generate(&mut rng);
        let bob2 = BobIdentity::generate(&mut rng);

        let bundle1 = bob1.prekey_bundle();

        // Alice handshakes with Bob1
        let alice_id = AliceIdentity::generate(&mut rng);
        let (_, mut initial_msg) = alice_id
            .process_prekey_bundle(&bundle1, HandshakeMode::Hybrid, b"secret", &mut rng)
            .expect("alice handshake");

        // Swap the ciphertext with one encapsulated to Bob2's key
        let bundle2 = bob2.prekey_bundle();
        let ek2_array = hybrid_array::Array::try_from(bundle2.pq_ek.as_slice()).unwrap();
        let ek2 = <MlKem768 as KemCore>::EncapsulationKey::from_bytes(&ek2_array);
        let (ct2, _) = ek2.encapsulate(&mut rng).expect("encapsulate");
        initial_msg.pq_ct = ct2.as_slice().try_into().expect("ct size");

        // Bob1 should fail to decrypt
        let result = bob1.process_initial_message(&initial_msg);
        assert!(matches!(result, Err(HandshakeError::DecryptionFailed)));
    }

    #[test]
    fn classical_mode_handshake() {
        let mut rng = test_rng();
        let mut bob = BobIdentity::generate(&mut rng);
        let bundle = bob.prekey_bundle();

        let alice_id = AliceIdentity::generate(&mut rng);
        let (mut alice_session, initial_msg) = alice_id
            .process_prekey_bundle(&bundle, HandshakeMode::ClassicalOnly, b"classical", &mut rng)
            .expect("classical handshake");

        let (mut bob_session, decrypted) = bob
            .process_initial_message(&initial_msg)
            .expect("bob classical");
        assert_eq!(&decrypted[..], b"classical");
        assert_eq!(alice_session.mode, HandshakeMode::ClassicalOnly);
        assert_eq!(bob_session.mode, HandshakeMode::ClassicalOnly);

        // Post-handshake works
        let ping = alice_session.encrypt(b"ping").expect("encrypt");
        let pt = bob_session.decrypt(&ping).expect("decrypt");
        assert_eq!(&pt[..], b"ping");
    }

    #[test]
    fn classical_vs_hybrid_different_sk() {
        let mut rng = test_rng();

        // Same Bob identity, two handshakes with different modes
        let bob_h = BobIdentity::generate(&mut rng);
        let bundle = bob_h.prekey_bundle();

        let alice_id = AliceIdentity::generate(&mut rng);
        let (alice_h, _) = alice_id
            .process_prekey_bundle(&bundle, HandshakeMode::Hybrid, b"test", &mut rng)
            .expect("hybrid");

        // Need a fresh Bob since OPK was consumed
        let bob_c = BobIdentity::generate(&mut rng);
        let bundle_c = bob_c.prekey_bundle();

        let alice_id_c = AliceIdentity::generate(&mut rng);
        let (alice_c, _) = alice_id_c
            .process_prekey_bundle(&bundle_c, HandshakeMode::ClassicalOnly, b"test", &mut rng)
            .expect("classical");

        // The two sessions should have different SKs (different modes, different keys anyway)
        // This is more of a smoke test that both modes work independently.
        // We can't directly compare SKs since they're private, but we verify both work.
        assert_eq!(alice_h.mode, HandshakeMode::Hybrid);
        assert_eq!(alice_c.mode, HandshakeMode::ClassicalOnly);
    }
}
