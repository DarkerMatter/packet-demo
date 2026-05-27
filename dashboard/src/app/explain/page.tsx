"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { TabNav } from "@/components/shell/tab-nav";

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-sm font-bold">
        {n}
      </div>
      <div className="flex-1 pb-8 border-l border-zinc-800 pl-6 -ml-4 mt-1">
        <h3 className="text-base font-semibold text-zinc-100 mb-2">{title}</h3>
        <div className="text-sm text-zinc-400 leading-relaxed space-y-3">{children}</div>
      </div>
    </div>
  );
}

function Tag({ color, children }: { color: string; children: React.ReactNode }) {
  const colors: Record<string, string> = {
    blue: "bg-blue-900/50 text-blue-300 border-blue-800",
    green: "bg-emerald-900/50 text-emerald-300 border-emerald-800",
    red: "bg-red-900/50 text-red-300 border-red-800",
    purple: "bg-purple-900/50 text-purple-300 border-purple-800",
    yellow: "bg-amber-900/50 text-amber-300 border-amber-800",
  };
  return (
    <span className={`inline-block px-2 py-0.5 text-xs font-mono rounded border ${colors[color] || colors.blue}`}>
      {children}
    </span>
  );
}

export default function ExplainPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-mono">
      <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold tracking-tight">
              <span className="text-indigo-400">PQXDH</span> Explained
            </h1>
          </div>
          <TabNav />
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-10 space-y-10">

        {/* Intro */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold">How Two Devices Establish a Shared Secret</h2>
          <p className="text-zinc-400 text-lg leading-relaxed">
            When the USV and Ground Station need to communicate securely, they face a fundamental problem:
            how do you agree on an encryption key when anyone could be listening to your conversation?
          </p>
          <p className="text-zinc-400 leading-relaxed">
            This is the <strong className="text-zinc-200">key exchange problem</strong>, and Signal&apos;s PQXDH protocol
            solves it in a way that&apos;s secure even against future quantum computers.
          </p>
        </div>

        <Separator className="bg-zinc-800" />

        {/* The Problem */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-lg">The Problem: Harvest Now, Decrypt Later</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-zinc-400 leading-relaxed">
            <p>
              Imagine an adversary (Eve) recording all network traffic today. With current encryption
              (like standard Diffie-Hellman), that traffic is safe &mdash; Eve can&apos;t decrypt it.
            </p>
            <p>
              But quantum computers running <strong className="text-zinc-200">Shor&apos;s algorithm</strong> will
              eventually break the math that classical key exchanges rely on (the difficulty of computing
              discrete logarithms on elliptic curves). Eve can store today&apos;s traffic and decrypt it
              in 2034 when quantum computers are powerful enough.
            </p>
            <div className="bg-red-950/30 border border-red-900/50 rounded-lg p-4">
              <p className="text-red-300 font-medium">This is called the &ldquo;harvest now, decrypt later&rdquo; attack.</p>
              <p className="text-red-300/70 mt-1">
                It&apos;s not theoretical &mdash; nation-state actors are already stockpiling encrypted traffic.
              </p>
            </div>
          </CardContent>
        </Card>

        <Separator className="bg-zinc-800" />

        {/* The Solution */}
        <div>
          <h2 className="text-xl font-bold mb-2">The Solution: Hybrid Key Exchange</h2>
          <p className="text-zinc-400 mb-6">
            PQXDH combines <strong className="text-zinc-200">two independent key exchanges</strong> into one.
            An attacker needs to break <em>both</em> to read the traffic:
          </p>

          <div className="grid md:grid-cols-2 gap-4">
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base">X25519</CardTitle>
                  <Badge variant="outline" className="text-xs border-amber-800 text-amber-300">Classical</Badge>
                </div>
              </CardHeader>
              <CardContent className="text-sm text-zinc-400 space-y-2">
                <p>Elliptic Curve Diffie-Hellman on Curve25519. Battle-tested, fast, and trusted.</p>
                <p className="text-amber-300/80">
                  Vulnerable to quantum computers (Shor&apos;s algorithm). Still safe today, estimated breakable by ~2035.
                </p>
                <p className="text-zinc-500 text-xs">Key size: 32 bytes. Used in Signal, WhatsApp, SSH, TLS.</p>
              </CardContent>
            </Card>

            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base">ML-KEM-768</CardTitle>
                  <Badge variant="outline" className="text-xs border-emerald-800 text-emerald-300">Post-Quantum</Badge>
                </div>
              </CardHeader>
              <CardContent className="text-sm text-zinc-400 space-y-2">
                <p>Module Lattice-Based Key Encapsulation (FIPS 203, formerly Kyber). Based on the hardness of lattice problems.</p>
                <p className="text-emerald-300/80">
                  Resistant to all known quantum attacks. Selected by NIST after 6 years of evaluation.
                </p>
                <p className="text-zinc-500 text-xs">Public key: 1184 bytes. Ciphertext: 1088 bytes. New but heavily analyzed.</p>
              </CardContent>
            </Card>
          </div>

          <div className="mt-4 bg-indigo-950/30 border border-indigo-900/50 rounded-lg p-4 text-sm">
            <p className="text-indigo-300 font-medium">Why both?</p>
            <p className="text-indigo-300/70 mt-1">
              ML-KEM is new &mdash; what if someone finds a flaw? X25519 is proven but quantum-vulnerable.
              By combining them, you&apos;re safe even if one algorithm is completely broken.
              This is called <strong>defense in depth</strong>.
            </p>
          </div>
        </div>

        <Separator className="bg-zinc-800" />

        {/* Protocol Steps */}
        <div>
          <h2 className="text-xl font-bold mb-6">The PQXDH Protocol Step by Step</h2>

          <Step n={1} title="Ground Station generates keys">
            <p>On boot, the Ground Station creates several key pairs:</p>
            <div className="space-y-1 font-mono text-xs">
              <p><Tag color="blue">IK_B</Tag> X25519 identity key &mdash; long-term, identifies this station</p>
              <p><Tag color="blue">SPK_B</Tag> X25519 signed prekey &mdash; rotated periodically</p>
              <p><Tag color="purple">PQPK_B</Tag> ML-KEM-768 key pair &mdash; the post-quantum component</p>
              <p><Tag color="blue">OPK_B</Tag> X25519 one-time prekey &mdash; used once, then discarded</p>
              <p><Tag color="green">Ed25519</Tag> Signing key &mdash; signs SPK and PQPK to prove authenticity</p>
            </div>
            <p className="mt-2">
              All public keys + signatures are bundled into a <strong className="text-zinc-200">Prekey Bundle</strong> (1440 bytes)
              and broadcast for the USV to pick up.
            </p>
          </Step>

          <Step n={2} title="USV receives and verifies the bundle">
            <p>
              The USV receives the bundle and <strong className="text-zinc-200">verifies the Ed25519 signatures</strong> on
              SPK and PQPK. This prevents a man-in-the-middle from swapping in their own keys.
            </p>
            <p>If signatures don&apos;t match, the handshake is rejected immediately.</p>
          </Step>

          <Step n={3} title="USV computes four Diffie-Hellman exchanges">
            <p>The USV generates a fresh ephemeral key <Tag color="blue">EK_A</Tag> and computes:</p>
            <div className="bg-zinc-950 rounded-lg p-3 font-mono text-xs space-y-1 mt-2">
              <p><span className="text-zinc-500">DH1 =</span> <span className="text-blue-300">X25519(IK_A, SPK_B)</span> <span className="text-zinc-600">// identity vs signed prekey</span></p>
              <p><span className="text-zinc-500">DH2 =</span> <span className="text-blue-300">X25519(EK_A, IK_B)</span> <span className="text-zinc-600">// ephemeral vs identity</span></p>
              <p><span className="text-zinc-500">DH3 =</span> <span className="text-blue-300">X25519(EK_A, SPK_B)</span> <span className="text-zinc-600">// ephemeral vs signed prekey</span></p>
              <p><span className="text-zinc-500">DH4 =</span> <span className="text-blue-300">X25519(EK_A, OPK_B)</span> <span className="text-zinc-600">// ephemeral vs one-time key</span></p>
            </div>
            <p className="mt-2 text-zinc-500 text-xs">
              Each DH gives mutual authentication or forward secrecy. Together they ensure both parties are
              who they claim to be and that past sessions can&apos;t be decrypted if keys leak later.
            </p>
          </Step>

          <Step n={4} title="USV encapsulates with ML-KEM-768">
            <p>
              This is the post-quantum step. The USV uses the Ground Station&apos;s ML-KEM public key to
              perform <strong className="text-zinc-200">key encapsulation</strong>:
            </p>
            <div className="bg-zinc-950 rounded-lg p-3 font-mono text-xs mt-2">
              <p><span className="text-zinc-500">(CT, SS) =</span> <span className="text-purple-300">ML-KEM-768.Encapsulate(PQPK_B)</span></p>
              <p className="text-zinc-600 mt-1">// CT = 1088-byte ciphertext, SS = 32-byte shared secret</p>
            </div>
            <p className="mt-2">
              Only someone with the ML-KEM <em>private</em> key can recover SS from CT.
              A quantum computer can&apos;t help &mdash; lattice problems remain hard.
            </p>
          </Step>

          <Step n={5} title="Both derive the same session key">
            <p>All the shared secrets are combined through HKDF (a key derivation function):</p>
            <div className="bg-zinc-950 rounded-lg p-3 font-mono text-xs mt-2">
              <p><span className="text-zinc-500">IKM =</span> <span className="text-zinc-300">0xFF*32 || DH1 || DH2 || DH3 || DH4 || SS</span></p>
              <p><span className="text-zinc-500">SK  =</span> <span className="text-yellow-300">HKDF-SHA256(salt=0, ikm=IKM, info=&quot;PQXDH-demo-v1&quot;)</span></p>
            </div>
            <p className="mt-2">
              The Ground Station performs the mirror operations (decapsulate ML-KEM, compute the same four DHs)
              and arrives at the <strong className="text-zinc-200">exact same SK</strong>.
              Neither side ever sent SK over the wire.
            </p>
          </Step>

          <Step n={6} title="Encrypted communication begins">
            <p>
              With a shared <Tag color="yellow">SK</Tag>, both sides use{" "}
              <strong className="text-zinc-200">ChaCha20-Poly1305</strong> (an AEAD cipher) to encrypt
              every subsequent message with a unique nonce.
            </p>
            <p>
              An eavesdropper sees random bytes. Even if they record everything, they cannot recover
              the telemetry data without breaking <em>both</em> X25519 and ML-KEM-768.
            </p>
          </Step>
        </div>

        <Separator className="bg-zinc-800" />

        {/* Packet Sizes */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-lg">What Actually Goes Over the Wire</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-zinc-400 space-y-4 leading-relaxed">
            <p>
              Every piece of data has a concrete size. Here&apos;s what a single telemetry exchange looks like:
            </p>
            <div className="space-y-2">
              <div className="flex items-center justify-between bg-zinc-950 rounded px-3 py-2">
                <span className="text-zinc-300">Prekey Bundle (handshake, sent once)</span>
                <span className="text-indigo-400 font-mono font-bold">1,440 bytes</span>
              </div>
              <div className="bg-zinc-950 rounded px-3 py-2 space-y-1 text-xs">
                <div className="flex justify-between"><span className="text-zinc-500">Ed25519 verify key</span><span className="text-zinc-400 font-mono">32 B</span></div>
                <div className="flex justify-between"><span className="text-zinc-500">X25519 identity key</span><span className="text-zinc-400 font-mono">32 B</span></div>
                <div className="flex justify-between"><span className="text-zinc-500">X25519 signed prekey + signature</span><span className="text-zinc-400 font-mono">96 B</span></div>
                <div className="flex justify-between"><span className="text-zinc-500">ML-KEM-768 encapsulation key + signature</span><span className="text-zinc-400 font-mono">1,248 B</span></div>
                <div className="flex justify-between"><span className="text-zinc-500">X25519 one-time prekey</span><span className="text-zinc-400 font-mono">32 B</span></div>
              </div>
              <div className="flex items-center justify-between bg-zinc-950 rounded px-3 py-2">
                <span className="text-zinc-300">InitialMessage (handshake, sent once)</span>
                <span className="text-indigo-400 font-mono font-bold">~1,284 bytes</span>
              </div>
              <div className="bg-zinc-950 rounded px-3 py-2 space-y-1 text-xs">
                <div className="flex justify-between"><span className="text-zinc-500">Alice&apos;s X25519 identity + ephemeral keys</span><span className="text-zinc-400 font-mono">64 B</span></div>
                <div className="flex justify-between"><span className="text-zinc-500">ML-KEM-768 ciphertext</span><span className="text-zinc-400 font-mono">1,088 B</span></div>
                <div className="flex justify-between"><span className="text-zinc-500">Mode + flags</span><span className="text-zinc-400 font-mono">4 B</span></div>
                <div className="flex justify-between"><span className="text-zinc-500">Encrypted initial payload + Poly1305 tag</span><span className="text-zinc-400 font-mono">~128 B</span></div>
              </div>
              <div className="flex items-center justify-between bg-zinc-950 rounded px-3 py-2">
                <span className="text-zinc-300">Telemetry frame (every update)</span>
                <span className="text-emerald-400 font-mono font-bold">~450 bytes</span>
              </div>
              <div className="bg-zinc-950 rounded px-3 py-2 space-y-1 text-xs">
                <div className="flex justify-between"><span className="text-zinc-500">Plaintext (all ship systems JSON)</span><span className="text-zinc-400 font-mono">~420 B</span></div>
                <div className="flex justify-between"><span className="text-zinc-500">ChaCha20-Poly1305 auth tag</span><span className="text-zinc-400 font-mono">16 B</span></div>
                <div className="flex justify-between"><span className="text-zinc-500">Counter nonce + direction AAD</span><span className="text-zinc-400 font-mono">~16 B</span></div>
              </div>
            </div>
            <div className="bg-indigo-950/30 border border-indigo-900/50 rounded-lg p-4 text-sm">
              <p className="text-indigo-300 font-medium">Overhead is minimal</p>
              <p className="text-indigo-300/70 mt-1">
                The handshake costs ~2,724 bytes total — paid once. After that, each telemetry frame adds
                only 16 bytes of encryption overhead (the Poly1305 authentication tag). That&apos;s <strong>3.8%</strong> overhead
                on a 420-byte payload. Full ship telemetry — 5 jets, 5 engines, 5 transmissions, 3 generators,
                HVAC, waste, fire suppression, radar contacts, bow thrusters — all encrypted and authenticated
                in a single ~450 byte packet.
              </p>
            </div>
          </CardContent>
        </Card>

        <Separator className="bg-zinc-800" />

        {/* What Eve Sees */}
        <Card className="bg-zinc-900 border-red-900/50">
          <CardHeader>
            <CardTitle className="text-lg text-red-400">What Does Eve Actually See?</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-zinc-400 space-y-4 leading-relaxed">
            <p>Eve can record the entire handshake. She sees:</p>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-zinc-950 rounded-lg p-4">
                <p className="text-red-300 font-medium text-xs uppercase mb-2">Eve has (public data)</p>
                <ul className="space-y-1 text-xs text-zinc-400">
                  <li>All public keys (IK_A, IK_B, SPK_B, EK_A, OPK_B, PQPK_B)</li>
                  <li>The ML-KEM ciphertext (CT, 1088 bytes)</li>
                  <li>Ed25519 signatures</li>
                  <li>All encrypted messages</li>
                </ul>
              </div>
              <div className="bg-zinc-950 rounded-lg p-4">
                <p className="text-emerald-300 font-medium text-xs uppercase mb-2">Eve is missing (private data)</p>
                <ul className="space-y-1 text-xs text-zinc-400">
                  <li>All private keys (never transmitted)</li>
                  <li>DH shared secrets (computed locally)</li>
                  <li>ML-KEM shared secret SS</li>
                  <li>The derived session key SK</li>
                </ul>
              </div>
            </div>
            <p>
              To derive SK, Eve would need to either solve the <strong className="text-zinc-200">Elliptic Curve Discrete Log Problem</strong> (for X25519)
              or the <strong className="text-zinc-200">Module Learning With Errors problem</strong> (for ML-KEM).
              Classical computers can&apos;t do either in reasonable time. Quantum computers can do the first but not the second.
            </p>
          </CardContent>
        </Card>

        <Separator className="bg-zinc-800" />

        {/* Simplifications */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-lg">Demo Simplifications</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-zinc-400 space-y-3 leading-relaxed">
            <p>This demo implements the real PQXDH math but simplifies a few things vs. production Signal:</p>
            <ul className="space-y-2">
              <li className="flex gap-2">
                <span className="text-zinc-500 flex-shrink-0">1.</span>
                <span><strong className="text-zinc-300">No Double Ratchet.</strong> After the handshake, we use SK directly. Real Signal rotates keys per message for forward secrecy on every single message.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-zinc-500 flex-shrink-0">2.</span>
                <span><strong className="text-zinc-300">Separate signing key.</strong> We use Ed25519 for signatures. Real Signal uses XEdDSA to sign with the X25519 key directly, avoiding a separate key.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-zinc-500 flex-shrink-0">3.</span>
                <span><strong className="text-zinc-300">No identity verification.</strong> Real Signal verifies identity keys via safety numbers (QR codes). We trust the keys on first use.</span>
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Nav */}
        <div className="flex justify-center pb-10">
          <Link
            href="/"
            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg transition-colors"
          >
            Back to Live Demo &rarr;
          </Link>
        </div>
      </div>
    </div>
  );
}
