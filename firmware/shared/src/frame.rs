use crate::wire;

/// ESP-NOW max payload is 250 bytes. Our header is 8 bytes, so 242 bytes of payload per fragment.
pub const ESPNOW_MAX_PAYLOAD: usize = 250;
pub const FRAME_HEADER_LEN: usize = 8;
pub const FRAME_MAX_DATA: usize = ESPNOW_MAX_PAYLOAD - FRAME_HEADER_LEN;

/// Max fragments for any message. PrekeyBundle is 1440 bytes → ceil(1440/242) = 6.
/// InitialMessage is ~1284 → 6. Give headroom.
pub const MAX_FRAGMENTS: usize = 8;

/// Max concurrent in-flight messages per peer for reassembly.
pub const MAX_INFLIGHT: usize = 2;

/// Frame header:
/// [msg_type: u8][msg_id: u16 LE][frag_idx: u8][frag_total: u8][reserved: u8][len: u16 LE]
/// Total: 8 bytes
#[derive(Clone, Debug)]
pub struct Frame {
    pub msg_type: u8,
    pub msg_id: u16,
    pub frag_idx: u8,
    pub frag_total: u8,
    pub payload: heapless::Vec<u8, 242>,
}

impl Frame {
    /// Encode frame to bytes ready for ESP-NOW transmission.
    pub fn encode(&self) -> heapless::Vec<u8, 250> {
        let mut buf = heapless::Vec::new();
        let _ = buf.push(self.msg_type);
        let _ = buf.extend_from_slice(&self.msg_id.to_le_bytes());
        let _ = buf.push(self.frag_idx);
        let _ = buf.push(self.frag_total);
        let _ = buf.push(0); // reserved
        let len = self.payload.len() as u16;
        let _ = buf.extend_from_slice(&len.to_le_bytes());
        let _ = buf.extend_from_slice(&self.payload);
        buf
    }

    /// Decode frame from raw ESP-NOW bytes.
    pub fn decode(buf: &[u8]) -> Option<Self> {
        if buf.len() < FRAME_HEADER_LEN {
            return None;
        }
        let msg_type = buf[0];
        let msg_id = u16::from_le_bytes([buf[1], buf[2]]);
        let frag_idx = buf[3];
        let frag_total = buf[4];
        // buf[5] is reserved
        let len = u16::from_le_bytes([buf[6], buf[7]]) as usize;

        if buf.len() < FRAME_HEADER_LEN + len || len > FRAME_MAX_DATA {
            return None;
        }

        let mut payload = heapless::Vec::new();
        let _ = payload.extend_from_slice(&buf[FRAME_HEADER_LEN..FRAME_HEADER_LEN + len]);
        Some(Frame {
            msg_type,
            msg_id,
            frag_idx,
            frag_total,
            payload,
        })
    }
}

/// Fragment a message into ESP-NOW-sized frames.
pub fn fragment(msg_type: u8, msg_id: u16, data: &[u8]) -> heapless::Vec<Frame, MAX_FRAGMENTS> {
    let mut frames = heapless::Vec::new();
    let total_frags = (data.len() + FRAME_MAX_DATA - 1) / FRAME_MAX_DATA;
    let frag_total = total_frags.max(1) as u8;

    if data.is_empty() {
        let _ = frames.push(Frame {
            msg_type,
            msg_id,
            frag_idx: 0,
            frag_total: 1,
            payload: heapless::Vec::new(),
        });
        return frames;
    }

    for (i, chunk) in data.chunks(FRAME_MAX_DATA).enumerate() {
        let mut payload = heapless::Vec::new();
        let _ = payload.extend_from_slice(chunk);
        let _ = frames.push(Frame {
            msg_type,
            msg_id,
            frag_idx: i as u8,
            frag_total,
            payload,
        });
    }
    frames
}

/// Reassembly buffer for a single in-flight message.
struct ReassemblySlot {
    msg_type: u8,
    msg_id: u16,
    frag_total: u8,
    received: u8,
    fragments: [Option<heapless::Vec<u8, 242>>; MAX_FRAGMENTS],
    /// Tick when this slot was first used (caller provides monotonic tick).
    started_tick: u32,
}

impl ReassemblySlot {
    fn new(msg_type: u8, msg_id: u16, frag_total: u8, tick: u32) -> Self {
        Self {
            msg_type,
            msg_id,
            frag_total,
            received: 0,
            fragments: Default::default(),
            started_tick: tick,
        }
    }

    fn is_complete(&self) -> bool {
        self.received == self.frag_total
    }

    /// Assemble the complete message from fragments.
    fn assemble(&self) -> heapless::Vec<u8, 2048> {
        let mut out = heapless::Vec::new();
        for i in 0..self.frag_total as usize {
            if let Some(frag) = &self.fragments[i] {
                let _ = out.extend_from_slice(frag);
            }
        }
        out
    }
}

/// Reassembler that handles up to MAX_INFLIGHT concurrent messages.
pub struct Reassembler {
    slots: [Option<ReassemblySlot>; MAX_INFLIGHT],
    timeout_ticks: u32,
}

/// Result of feeding a frame to the reassembler.
pub enum ReassemblyResult {
    /// Message not yet complete, keep feeding.
    Incomplete,
    /// Message complete. Contains (msg_type, assembled data).
    Complete(u8, heapless::Vec<u8, 2048>),
    /// Frame was a duplicate or invalid.
    Dropped,
}

impl Reassembler {
    /// Create a new reassembler.
    /// `timeout_ticks`: number of ticks after which an incomplete message slot is reclaimed.
    pub fn new(timeout_ticks: u32) -> Self {
        Self {
            slots: Default::default(),
            timeout_ticks,
        }
    }

    /// Feed a frame into the reassembler.
    /// `current_tick`: monotonic tick counter (units are caller-defined, e.g., milliseconds).
    pub fn feed(&mut self, frame: &Frame, current_tick: u32) -> ReassemblyResult {
        if frame.frag_idx >= frame.frag_total || frame.frag_total as usize > MAX_FRAGMENTS {
            return ReassemblyResult::Dropped;
        }

        // Expire timed-out slots.
        for slot in self.slots.iter_mut() {
            if let Some(s) = slot {
                if current_tick.wrapping_sub(s.started_tick) > self.timeout_ticks {
                    *slot = None;
                }
            }
        }

        // Find existing slot for this msg_id.
        let existing = self
            .slots
            .iter_mut()
            .find(|s| s.as_ref().is_some_and(|s| s.msg_id == frame.msg_id));

        if let Some(slot_opt) = existing {
            let slot = slot_opt.as_mut().unwrap();

            // Validate consistency.
            if slot.msg_type != frame.msg_type || slot.frag_total != frame.frag_total {
                return ReassemblyResult::Dropped;
            }

            let idx = frame.frag_idx as usize;
            if slot.fragments[idx].is_some() {
                return ReassemblyResult::Dropped; // duplicate
            }

            slot.fragments[idx] = Some(frame.payload.clone());
            slot.received += 1;

            if slot.is_complete() {
                let result = slot.assemble();
                let msg_type = slot.msg_type;
                *slot_opt = None;
                ReassemblyResult::Complete(msg_type, result)
            } else {
                ReassemblyResult::Incomplete
            }
        } else {
            // Allocate a new slot.
            let free = self.slots.iter_mut().find(|s| s.is_none());
            if let Some(slot_opt) = free {
                let mut slot =
                    ReassemblySlot::new(frame.msg_type, frame.msg_id, frame.frag_total, current_tick);
                slot.fragments[frame.frag_idx as usize] = Some(frame.payload.clone());
                slot.received = 1;

                if slot.is_complete() {
                    let result = slot.assemble();
                    let msg_type = slot.msg_type;
                    ReassemblyResult::Complete(msg_type, result)
                } else {
                    *slot_opt = Some(slot);
                    ReassemblyResult::Incomplete
                }
            } else {
                // All slots full — drop oldest.
                let oldest_idx = self
                    .slots
                    .iter()
                    .enumerate()
                    .min_by_key(|(_, s)| s.as_ref().map(|s| s.started_tick).unwrap_or(u32::MAX))
                    .map(|(i, _)| i)
                    .unwrap_or(0);

                let mut slot =
                    ReassemblySlot::new(frame.msg_type, frame.msg_id, frame.frag_total, current_tick);
                slot.fragments[frame.frag_idx as usize] = Some(frame.payload.clone());
                slot.received = 1;

                if slot.is_complete() {
                    let result = slot.assemble();
                    let msg_type = slot.msg_type;
                    self.slots[oldest_idx] = None;
                    ReassemblyResult::Complete(msg_type, result)
                } else {
                    self.slots[oldest_idx] = Some(slot);
                    ReassemblyResult::Incomplete
                }
            }
        }
    }
}

/// Dispatch a complete reassembled message to the appropriate wire decoder.
pub enum DecodedMessage {
    PrekeyBundle(crate::pqxdh::PrekeyBundle),
    InitialMessage(crate::pqxdh::InitialMessage),
    SessionMessage(crate::pqxdh::SessionMessage),
    LogRelay(crate::pqxdh::LogRelay),
}

impl DecodedMessage {
    pub fn from_reassembled(msg_type: u8, data: &[u8]) -> Result<Self, wire::WireError> {
        match msg_type {
            wire::MSG_PREKEY_BUNDLE => {
                Ok(DecodedMessage::PrekeyBundle(crate::pqxdh::PrekeyBundle::decode(data)?))
            }
            wire::MSG_INITIAL_MESSAGE => {
                Ok(DecodedMessage::InitialMessage(crate::pqxdh::InitialMessage::decode(data)?))
            }
            wire::MSG_SESSION_MESSAGE => {
                Ok(DecodedMessage::SessionMessage(crate::pqxdh::SessionMessage::decode(data)?))
            }
            wire::MSG_LOG_RELAY => {
                Ok(DecodedMessage::LogRelay(crate::pqxdh::LogRelay::decode(data)?))
            }
            _ => Err(wire::WireError::InvalidMsgType),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn single_frame_message() {
        let data = b"hello world";
        let frames = fragment(wire::MSG_SESSION_MESSAGE, 1, data);
        assert_eq!(frames.len(), 1);
        assert_eq!(frames[0].frag_total, 1);
        assert_eq!(frames[0].frag_idx, 0);
        assert_eq!(&frames[0].payload[..], data);
    }

    #[test]
    fn multi_frame_roundtrip() {
        // Simulate a PrekeyBundle-sized message
        let data = [0xAB; 1440];
        let frames = fragment(wire::MSG_PREKEY_BUNDLE, 42, &data);
        assert_eq!(frames.len(), 6); // ceil(1440/242) = 6

        let mut reassembler = Reassembler::new(2000);
        for (i, frame) in frames.iter().enumerate() {
            let result = reassembler.feed(frame, 100);
            if i < frames.len() - 1 {
                assert!(matches!(result, ReassemblyResult::Incomplete));
            } else {
                match result {
                    ReassemblyResult::Complete(msg_type, assembled) => {
                        assert_eq!(msg_type, wire::MSG_PREKEY_BUNDLE);
                        assert_eq!(&assembled[..], &data[..]);
                    }
                    _ => panic!("expected Complete"),
                }
            }
        }
    }

    #[test]
    fn out_of_order_reassembly() {
        let data = [0xCD; 600];
        let frames = fragment(wire::MSG_INITIAL_MESSAGE, 7, &data);
        assert!(frames.len() > 1);

        // Feed in reverse order
        let mut reassembler = Reassembler::new(2000);
        let last = frames.len() - 1;
        for i in (0..=last).rev() {
            let result = reassembler.feed(&frames[i], 100);
            if i > 0 {
                assert!(matches!(result, ReassemblyResult::Incomplete));
            } else {
                match result {
                    ReassemblyResult::Complete(_, assembled) => {
                        assert_eq!(&assembled[..], &data[..]);
                    }
                    _ => panic!("expected Complete after all fragments"),
                }
            }
        }
    }

    #[test]
    fn duplicate_fragment_dropped() {
        let data = [0xEF; 500];
        let frames = fragment(wire::MSG_SESSION_MESSAGE, 10, &data);

        let mut reassembler = Reassembler::new(2000);
        // Feed first fragment
        let _ = reassembler.feed(&frames[0], 100);
        // Feed same fragment again — should be dropped
        let result = reassembler.feed(&frames[0], 100);
        assert!(matches!(result, ReassemblyResult::Dropped));
    }

    #[test]
    fn timeout_clears_slot() {
        let data = [0x11; 500];
        let frames = fragment(wire::MSG_SESSION_MESSAGE, 20, &data);

        let mut reassembler = Reassembler::new(2000);
        // Feed first fragment at tick 100
        let _ = reassembler.feed(&frames[0], 100);

        // Feed a different message's fragment at tick 3000 (after timeout)
        let frames2 = fragment(wire::MSG_SESSION_MESSAGE, 21, b"short");
        let result = reassembler.feed(&frames2[0], 3000);
        // The old slot should have been expired, and the new single-frame message completes
        assert!(matches!(result, ReassemblyResult::Complete(_, _)));
    }

    #[test]
    fn frame_encode_decode_roundtrip() {
        let mut payload = heapless::Vec::new();
        let _ = payload.extend_from_slice(b"test payload data");
        let frame = Frame {
            msg_type: wire::MSG_SESSION_MESSAGE,
            msg_id: 0x1234,
            frag_idx: 2,
            frag_total: 5,
            payload,
        };

        let encoded = frame.encode();
        let decoded = Frame::decode(&encoded).expect("decode");
        assert_eq!(decoded.msg_type, frame.msg_type);
        assert_eq!(decoded.msg_id, frame.msg_id);
        assert_eq!(decoded.frag_idx, frame.frag_idx);
        assert_eq!(decoded.frag_total, frame.frag_total);
        assert_eq!(&decoded.payload[..], &frame.payload[..]);
    }

    #[test]
    fn overflow_drops_oldest_slot() {
        let mut reassembler = Reassembler::new(10000);

        // Fill all slots with incomplete messages
        for id in 0..MAX_INFLIGHT as u16 {
            let frames = fragment(wire::MSG_SESSION_MESSAGE, id, &[0xAA; 500]);
            let _ = reassembler.feed(&frames[0], id as u32 * 100);
        }

        // New message should evict the oldest slot
        let new_frames = fragment(wire::MSG_SESSION_MESSAGE, 99, b"new");
        let result = reassembler.feed(&new_frames[0], 5000);
        // Single-frame message completes immediately
        assert!(matches!(result, ReassemblyResult::Complete(_, _)));
    }
}
