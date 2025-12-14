# Voice Gateway TLS Issues

This document tracks TLS-related issues encountered when implementing voice connection tests for `@discordjs/voice` integration.

## Background

The `@discordjs/voice` library requires secure WebSocket connections (`wss://`) for voice gateway communication. Unlike the main Discord gateway which can optionally use `ws://` in development, voice connections **always** require TLS.

## Current Implementation

### Mock Voice Gateway

The mock voice gateway server (`src/core/voice-gateway.ts`) has been updated to use HTTPS/WSS:

1. **Self-Signed Certificates**: Using the `selfsigned` npm package to generate certificates dynamically
2. **HTTPS Server**: Created an HTTPS server that wraps the WebSocket server
3. **Port**: Runs on port 50001 by default

### Certificate Generation

Located in `src/utils/tls.ts`:

```typescript
import selfsigned from 'selfsigned'

export function generateSelfSignedCert(): { key: string; cert: string } {
  const attrs = [{ name: 'commonName', value: 'localhost' }]
  const pems = selfsigned.generate(attrs, {
    keySize: 2048,
    days: 365,
    algorithm: 'sha256'
  })

  return { key: pems.private, cert: pems.cert }
}
```

## Issues Encountered

### 1. TLS Handshake Failure (SSL Alert Number 40)

**Error:**
```
Error: 140656677416512:error:14094410:SSL routines:ssl3_read_bytes:sslv3 alert handshake failure:SSL alert number 40
```

**Cause:**
This error occurs due to a cipher suite or TLS protocol version mismatch between the client (Node.js/undici in discord.js) and the mock server.

**Attempted Solutions:**
- Setting `NODE_TLS_REJECT_UNAUTHORIZED=0` in test setup - **Did not resolve the issue**
- This environment variable only disables certificate validation, not cipher/protocol negotiation

### 2. Why This Happens

The `@discordjs/voice` library uses Node.js's built-in TLS implementation which:
1. Negotiates TLS version (1.2 or 1.3)
2. Negotiates cipher suites
3. Validates certificate chain (can be disabled)
4. Performs hostname verification (can be disabled)

The self-signed certificate works for validation bypass, but the cipher suite/protocol negotiation happens **before** certificate validation and cannot be bypassed with environment variables.

### 3. Potential Root Causes

1. **OpenSSL Version Mismatch**: The `selfsigned` package generates certificates that may not include all modern cipher extensions
2. **Node.js TLS Settings**: The WebSocket client may require specific TLS settings not configured by default
3. **ALPN/NPN Negotiation**: Application-Layer Protocol Negotiation may be failing

## Potential Solutions (For Future Implementation)

### Option 1: Use Real Certificates

For local development, use a tool like `mkcert` to generate locally-trusted certificates:

```bash
# Install mkcert
brew install mkcert  # macOS
mkcert -install
mkcert localhost 127.0.0.1 ::1
```

Then load these certificates instead of self-signed ones.

### Option 2: Proxy Through HTTP

Create an HTTP-to-WSS proxy that:
1. Accepts plain `ws://` connections
2. Forwards to the mock voice gateway
3. Handles TLS termination

### Option 3: Custom TLS Options

Modify the HTTPS server to use specific cipher suites:

```typescript
const httpsServer = https.createServer({
  key,
  cert,
  ciphers: 'ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384',
  honorCipherOrder: true,
  minVersion: 'TLSv1.2',
  maxVersion: 'TLSv1.3'
})
```

### Option 4: Mock the Voice Connection Layer

Instead of testing actual voice connections through WebSocket, mock the `@discordjs/voice` internal methods:
1. Mock `joinVoiceChannel` to return a fake VoiceConnection
2. Test state transitions without network I/O
3. This sacrifices integration testing depth but avoids TLS entirely

### Option 5: Use Node.js TLS Socket Directly

Investigate if Node.js `tls.createSecureContext()` with specific options can resolve negotiation issues:

```typescript
const context = tls.createSecureContext({
  key,
  cert,
  ciphers: 'TLS_AES_128_GCM_SHA256:TLS_AES_256_GCM_SHA384',
  ecdhCurve: 'auto'
})
```

## Current Workaround

Tests requiring actual voice connections are marked with `describe.skip`:

1. **`voice-connections.test.ts`** - All tests skipped (7 tests)
2. **`voice-events.test.ts`** - All tests skipped (4 tests)

Tests that don't require voice connections work correctly:

1. **`audio-player.test.ts`** - 4 tests pass (basic player, options, state events, stop)
2. **`audio-resource.test.ts`** - 8 tests pass (streams, metadata, volume, duration)
3. **`voice-adapter.test.ts`** - 2 tests pass (adapter existence verification)

## Test Environment Settings

The test setup (`__tests__/integration/test-setup.js`) includes:

```javascript
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
```

This allows tests to proceed but doesn't resolve the core TLS handshake issue.

## Priority

**Medium** - Voice connection testing would be valuable but:
1. The infrastructure (voice gateway, control APIs) is in place
2. Non-connection voice tests work correctly
3. Real Discord bots can be tested against actual Discord for voice
4. Most bot functionality doesn't require voice

## References

- Discord Voice Gateway Documentation: https://discord.com/developers/docs/topics/voice-connections
- @discordjs/voice Repository: https://github.com/discordjs/discord.js/tree/main/packages/voice
- Node.js TLS Documentation: https://nodejs.org/api/tls.html
- OpenSSL Cipher Suites: https://www.openssl.org/docs/man1.1.1/man1/ciphers.html
