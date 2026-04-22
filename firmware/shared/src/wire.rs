use crate::pqxdh::*;

#[derive(Debug)]
pub enum WireError {
    BufferTooSmall,
    InvalidLength,
    InvalidMsgType,
    InvalidMode,
}

// Message type tags for framing.
pub const MSG_PREKEY_BUNDLE: u8 = 0x01;
pub const MSG_INITIAL_MESSAGE: u8 = 0x02;
pub const MSG_SESSION_MESSAGE: u8 = 0x03;
pub const MSG_LOG_RELAY: u8 = 0x04;

// --- PrekeyBundle wire format ---
// Total: 32 + 32 + 32 + 64 + 1184 + 64 + 32 = 1440 bytes
pub const PREKEY_BUNDLE_WIRE_LEN: usize = ED25519_VERIFY_KEY_LEN
    + X25519_KEY_LEN
    + X25519_KEY_LEN
    + ED25519_SIG_LEN
    + MLKEM768_EK_LEN
    + ED25519_SIG_LEN
    + X25519_KEY_LEN;

impl PrekeyBundle {
    pub fn encode(&self) -> heapless::Vec<u8, 1440> {
        let mut buf = heapless::Vec::new();
        // Safe: we know the total is exactly 1440
        let _ = buf.extend_from_slice(&self.id_verify);
        let _ = buf.extend_from_slice(&self.ik_pub);
        let _ = buf.extend_from_slice(&self.spk_pub);
        let _ = buf.extend_from_slice(&self.spk_sig);
        let _ = buf.extend_from_slice(&self.pq_ek);
        let _ = buf.extend_from_slice(&self.pq_sig);
        let _ = buf.extend_from_slice(&self.opk_pub);
        buf
    }

    pub fn decode(buf: &[u8]) -> Result<Self, WireError> {
        if buf.len() < PREKEY_BUNDLE_WIRE_LEN {
            return Err(WireError::InvalidLength);
        }
        let mut pos = 0;

        let mut id_verify = [0u8; ED25519_VERIFY_KEY_LEN];
        id_verify.copy_from_slice(&buf[pos..pos + ED25519_VERIFY_KEY_LEN]);
        pos += ED25519_VERIFY_KEY_LEN;

        let mut ik_pub = [0u8; X25519_KEY_LEN];
        ik_pub.copy_from_slice(&buf[pos..pos + X25519_KEY_LEN]);
        pos += X25519_KEY_LEN;

        let mut spk_pub = [0u8; X25519_KEY_LEN];
        spk_pub.copy_from_slice(&buf[pos..pos + X25519_KEY_LEN]);
        pos += X25519_KEY_LEN;

        let mut spk_sig = [0u8; ED25519_SIG_LEN];
        spk_sig.copy_from_slice(&buf[pos..pos + ED25519_SIG_LEN]);
        pos += ED25519_SIG_LEN;

        let mut pq_ek = [0u8; MLKEM768_EK_LEN];
        pq_ek.copy_from_slice(&buf[pos..pos + MLKEM768_EK_LEN]);
        pos += MLKEM768_EK_LEN;

        let mut pq_sig = [0u8; ED25519_SIG_LEN];
        pq_sig.copy_from_slice(&buf[pos..pos + ED25519_SIG_LEN]);
        pos += ED25519_SIG_LEN;

        let mut opk_pub = [0u8; X25519_KEY_LEN];
        opk_pub.copy_from_slice(&buf[pos..pos + X25519_KEY_LEN]);

        Ok(PrekeyBundle {
            id_verify,
            ik_pub,
            spk_pub,
            spk_sig,
            pq_ek,
            pq_sig,
            opk_pub,
        })
    }
}

// --- InitialMessage wire format ---
// ik_a_pub(32) + ek_a_pub(32) + pq_ct(1088) + used_opk(1) + mode(1) + ct_len(2) + ct(var)
// Max: 32 + 32 + 1088 + 1 + 1 + 2 + 128 = 1284
pub const INITIAL_MESSAGE_FIXED_LEN: usize =
    X25519_KEY_LEN + X25519_KEY_LEN + MLKEM768_CT_LEN + 1 + 1 + 2;

impl InitialMessage {
    pub fn encode(&self) -> heapless::Vec<u8, 1284> {
        let mut buf = heapless::Vec::new();
        let _ = buf.extend_from_slice(&self.ik_a_pub);
        let _ = buf.extend_from_slice(&self.ek_a_pub);
        let _ = buf.extend_from_slice(&self.pq_ct);
        let _ = buf.push(self.used_opk as u8);
        let _ = buf.push(match self.mode {
            HandshakeMode::Hybrid => 0x00,
            HandshakeMode::ClassicalOnly => 0x01,
        });
        let ct_len = self.ciphertext.len() as u16;
        let _ = buf.extend_from_slice(&ct_len.to_le_bytes());
        let _ = buf.extend_from_slice(&self.ciphertext);
        buf
    }

    pub fn decode(buf: &[u8]) -> Result<Self, WireError> {
        if buf.len() < INITIAL_MESSAGE_FIXED_LEN {
            return Err(WireError::InvalidLength);
        }
        let mut pos = 0;

        let mut ik_a_pub = [0u8; X25519_KEY_LEN];
        ik_a_pub.copy_from_slice(&buf[pos..pos + X25519_KEY_LEN]);
        pos += X25519_KEY_LEN;

        let mut ek_a_pub = [0u8; X25519_KEY_LEN];
        ek_a_pub.copy_from_slice(&buf[pos..pos + X25519_KEY_LEN]);
        pos += X25519_KEY_LEN;

        let mut pq_ct = [0u8; MLKEM768_CT_LEN];
        pq_ct.copy_from_slice(&buf[pos..pos + MLKEM768_CT_LEN]);
        pos += MLKEM768_CT_LEN;

        let used_opk = buf[pos] != 0;
        pos += 1;

        let mode = match buf[pos] {
            0x00 => HandshakeMode::Hybrid,
            0x01 => HandshakeMode::ClassicalOnly,
            _ => return Err(WireError::InvalidMode),
        };
        pos += 1;

        let ct_len = u16::from_le_bytes([buf[pos], buf[pos + 1]]) as usize;
        pos += 2;

        if buf.len() < pos + ct_len {
            return Err(WireError::InvalidLength);
        }
        let mut ciphertext = heapless::Vec::new();
        ciphertext
            .extend_from_slice(&buf[pos..pos + ct_len])
            .map_err(|_| WireError::BufferTooSmall)?;

        Ok(InitialMessage {
            ik_a_pub,
            ek_a_pub,
            pq_ct,
            used_opk,
            mode,
            ciphertext,
        })
    }
}

// --- SessionMessage wire format ---
// counter(4) + direction(1) + ct_len(2) + ct(var)
// Max: 4 + 1 + 2 + 128 = 135
pub const SESSION_MESSAGE_FIXED_LEN: usize = 4 + 1 + 2;

impl SessionMessage {
    pub fn encode(&self) -> heapless::Vec<u8, 135> {
        let mut buf = heapless::Vec::new();
        let _ = buf.extend_from_slice(&self.counter.to_le_bytes());
        let _ = buf.push(match self.direction {
            Direction::AliceToBob => 0x00,
            Direction::BobToAlice => 0x01,
        });
        let ct_len = self.ciphertext.len() as u16;
        let _ = buf.extend_from_slice(&ct_len.to_le_bytes());
        let _ = buf.extend_from_slice(&self.ciphertext);
        buf
    }

    pub fn decode(buf: &[u8]) -> Result<Self, WireError> {
        if buf.len() < SESSION_MESSAGE_FIXED_LEN {
            return Err(WireError::InvalidLength);
        }
        let mut pos = 0;

        let counter = u32::from_le_bytes([buf[pos], buf[pos + 1], buf[pos + 2], buf[pos + 3]]);
        pos += 4;

        let direction = match buf[pos] {
            0x00 => Direction::AliceToBob,
            0x01 => Direction::BobToAlice,
            _ => return Err(WireError::InvalidMsgType),
        };
        pos += 1;

        let ct_len = u16::from_le_bytes([buf[pos], buf[pos + 1]]) as usize;
        pos += 2;

        if buf.len() < pos + ct_len {
            return Err(WireError::InvalidLength);
        }
        let mut ciphertext = heapless::Vec::new();
        ciphertext
            .extend_from_slice(&buf[pos..pos + ct_len])
            .map_err(|_| WireError::BufferTooSmall)?;

        Ok(SessionMessage {
            counter,
            direction,
            ciphertext,
        })
    }
}

// --- LogRelay wire format ---
// len(2) + message(var)
// Max: 2 + 200 = 202

impl LogRelay {
    pub fn encode(&self) -> heapless::Vec<u8, 202> {
        let mut buf = heapless::Vec::new();
        let len = self.message.len() as u16;
        let _ = buf.extend_from_slice(&len.to_le_bytes());
        let _ = buf.extend_from_slice(&self.message);
        buf
    }

    pub fn decode(buf: &[u8]) -> Result<Self, WireError> {
        if buf.len() < 2 {
            return Err(WireError::InvalidLength);
        }
        let len = u16::from_le_bytes([buf[0], buf[1]]) as usize;
        if buf.len() < 2 + len {
            return Err(WireError::InvalidLength);
        }
        let mut message = heapless::Vec::new();
        message
            .extend_from_slice(&buf[2..2 + len])
            .map_err(|_| WireError::BufferTooSmall)?;
        Ok(LogRelay { message })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn prekey_bundle_roundtrip() {
        let bundle = PrekeyBundle {
            id_verify: [0xAA; ED25519_VERIFY_KEY_LEN],
            ik_pub: [0xBB; X25519_KEY_LEN],
            spk_pub: [0xCC; X25519_KEY_LEN],
            spk_sig: [0xDD; ED25519_SIG_LEN],
            pq_ek: [0xEE; MLKEM768_EK_LEN],
            pq_sig: [0xFF; ED25519_SIG_LEN],
            opk_pub: [0x11; X25519_KEY_LEN],
        };

        let encoded = bundle.encode();
        assert_eq!(encoded.len(), PREKEY_BUNDLE_WIRE_LEN);

        let decoded = PrekeyBundle::decode(&encoded).expect("decode");
        assert_eq!(decoded.id_verify, bundle.id_verify);
        assert_eq!(decoded.ik_pub, bundle.ik_pub);
        assert_eq!(decoded.spk_pub, bundle.spk_pub);
        assert_eq!(decoded.spk_sig, bundle.spk_sig);
        assert_eq!(decoded.pq_ek, bundle.pq_ek);
        assert_eq!(decoded.pq_sig, bundle.pq_sig);
        assert_eq!(decoded.opk_pub, bundle.opk_pub);
    }

    #[test]
    fn initial_message_roundtrip() {
        let mut ciphertext = heapless::Vec::new();
        let _ = ciphertext.extend_from_slice(b"encrypted-payload-here!");

        let msg = InitialMessage {
            ik_a_pub: [0x01; X25519_KEY_LEN],
            ek_a_pub: [0x02; X25519_KEY_LEN],
            pq_ct: [0x03; MLKEM768_CT_LEN],
            used_opk: true,
            mode: HandshakeMode::Hybrid,
            ciphertext,
        };

        let encoded = msg.encode();
        let decoded = InitialMessage::decode(&encoded).expect("decode");
        assert_eq!(decoded.ik_a_pub, msg.ik_a_pub);
        assert_eq!(decoded.ek_a_pub, msg.ek_a_pub);
        assert_eq!(decoded.pq_ct, msg.pq_ct);
        assert_eq!(decoded.used_opk, true);
        assert_eq!(decoded.mode, HandshakeMode::Hybrid);
        assert_eq!(&decoded.ciphertext[..], b"encrypted-payload-here!");
    }

    #[test]
    fn initial_message_classical_roundtrip() {
        let mut ciphertext = heapless::Vec::new();
        let _ = ciphertext.extend_from_slice(b"classical");

        let msg = InitialMessage {
            ik_a_pub: [0x01; X25519_KEY_LEN],
            ek_a_pub: [0x02; X25519_KEY_LEN],
            pq_ct: [0x00; MLKEM768_CT_LEN],
            used_opk: false,
            mode: HandshakeMode::ClassicalOnly,
            ciphertext,
        };

        let encoded = msg.encode();
        let decoded = InitialMessage::decode(&encoded).expect("decode");
        assert_eq!(decoded.mode, HandshakeMode::ClassicalOnly);
        assert_eq!(decoded.used_opk, false);
    }

    #[test]
    fn session_message_roundtrip() {
        let mut ciphertext = heapless::Vec::new();
        let _ = ciphertext.extend_from_slice(b"ping-encrypted");

        let msg = SessionMessage {
            counter: 42,
            direction: Direction::AliceToBob,
            ciphertext,
        };

        let encoded = msg.encode();
        let decoded = SessionMessage::decode(&encoded).expect("decode");
        assert_eq!(decoded.counter, 42);
        assert_eq!(decoded.direction, Direction::AliceToBob);
        assert_eq!(&decoded.ciphertext[..], b"ping-encrypted");
    }

    #[test]
    fn session_message_bob_to_alice_roundtrip() {
        let mut ciphertext = heapless::Vec::new();
        let _ = ciphertext.extend_from_slice(b"pong");

        let msg = SessionMessage {
            counter: 0,
            direction: Direction::BobToAlice,
            ciphertext,
        };

        let encoded = msg.encode();
        let decoded = SessionMessage::decode(&encoded).expect("decode");
        assert_eq!(decoded.direction, Direction::BobToAlice);
    }

    #[test]
    fn log_relay_roundtrip() {
        let mut message = heapless::Vec::new();
        let _ = message.extend_from_slice(b"[ALICE] handshake complete");

        let relay = LogRelay { message };
        let encoded = relay.encode();
        let decoded = LogRelay::decode(&encoded).expect("decode");
        assert_eq!(&decoded.message[..], b"[ALICE] handshake complete");
    }

    #[test]
    fn truncated_prekey_bundle_rejected() {
        let buf = [0u8; PREKEY_BUNDLE_WIRE_LEN - 1];
        assert!(PrekeyBundle::decode(&buf).is_err());
    }

    #[test]
    fn truncated_initial_message_rejected() {
        let buf = [0u8; INITIAL_MESSAGE_FIXED_LEN - 1];
        assert!(InitialMessage::decode(&buf).is_err());
    }

    #[test]
    fn truncated_session_message_rejected() {
        let buf = [0u8; SESSION_MESSAGE_FIXED_LEN - 1];
        assert!(SessionMessage::decode(&buf).is_err());
    }
}
