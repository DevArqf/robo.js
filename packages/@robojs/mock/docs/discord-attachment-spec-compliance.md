# Discord Attachment API Spec Compliance

This document tracks alignment between `@robojs/mock`'s attachment implementation and Discord's actual API behavior.

## Fully Implemented (Spec Compliant)

### Attachment Object Fields

| Field | Status | Notes |
|-------|--------|-------|
| `id` | ✅ | Snowflake ID, generated correctly |
| `filename` | ✅ | String, preserved from upload |
| `description` | ✅ | Alt text, validated max 1024 chars |
| `content_type` | ✅ | MIME type from upload |
| `size` | ✅ | File size in bytes |
| `url` | ✅ | CDN URL format matches Discord |
| `proxy_url` | ✅ | Set same as url (Discord behavior for mock) |
| `width` | ✅ | Extracted for PNG, JPEG, GIF, WebP |
| `height` | ✅ | Extracted for PNG, JPEG, GIF, WebP |
| `title` | ✅ | Optional title field |
| `ephemeral` | ✅ | Field present (behavior not differentiated) |
| `flags` | ✅ | Field present, `IS_REMIX` constant exported |
| `spoiler` | ✅ | Computed from `SPOILER_` filename prefix |

### Upload Limits (Discord Spec)

| Limit | Value | Status |
|-------|-------|--------|
| Max files per message | 10 | ✅ Enforced |
| Max total size | 25MB | ✅ Enforced |
| Max description length | 1024 chars | ✅ Enforced |

### Multipart Handling

| Feature | Status | Notes |
|---------|--------|-------|
| `payload_json` field | ✅ | Parsed correctly |
| `files[n]` fields | ✅ | Indexed file uploads |
| Attachment metadata merging | ✅ | `id` index maps to file |
| Error codes | ✅ | 50035, 40005 match Discord |

### CDN Behavior

| Feature | Status | Notes |
|---------|--------|-------|
| URL format | ✅ | `/cdn/attachments/{channel}/{id}/{filename}` |
| Content-Type header | ✅ | From stored metadata |
| Content-Length header | ✅ | From file size |
| Content-Disposition | ✅ | `inline` for images/videos, `attachment` for others |
| Spoiler handling | ✅ | Spoilered images use `attachment` disposition |
| RFC 5987 filename* | ✅ | UTF-8 filename encoding |
| Cache-Control | ✅ | `public, max-age=31536000` |
| CORS | ✅ | `Access-Control-Allow-Origin: *` |

---

## Partially Implemented

### Audio/Voice Messages

| Field | Status | Notes |
|-------|--------|-------|
| `duration_secs` | ⚠️ | Field exists, not auto-populated |
| `waveform` | ⚠️ | Field exists, not auto-populated |

**Reason**: Would require an audio parsing library to extract duration and generate waveforms. Discord.js doesn't require these for testing as they're typically display-only fields.

**Impact**: None for bot testing. Voice message metadata won't be realistic.

### Attachment Flags

| Flag | Value | Status |
|------|-------|--------|
| `IS_CLIP` | 1 | ⚠️ Not defined (Discord internal) |
| `IS_THUMBNAIL` | 2 | ⚠️ Not defined (Discord internal) |
| `IS_REMIX` | 4 | ✅ Defined and exported |

**Reason**: `IS_CLIP` and `IS_THUMBNAIL` are primarily used by Discord's mobile app for clip/thumbnail features. They're rarely set by bots.

**Impact**: None for bot testing.

---

## Not Implemented (By Design)

### Placeholder Attachments

| Field | Status | Notes |
|-------|--------|-------|
| `placeholder` | ❌ | Not implemented |
| `placeholder_version` | ❌ | Not implemented |

**Reason**: Placeholder attachments are a Discord-specific optimization for showing attachment previews before the full file is uploaded. This is a client-side feature and bots don't interact with placeholders.

**Impact**: None for bot testing.

### Per-User Size Limits

| User Type | Max Size | Status |
|-----------|----------|--------|
| Normal user | 8MB | ❌ Not enforced |
| Nitro Basic | 50MB | ❌ Not enforced |
| Nitro | 500MB | ❌ Not enforced |
| Server boost | Varies | ❌ Not enforced |

**Reason**: The mock server uses Discord's bot limit of 25MB total per message. User-specific limits would require auth context that's not available in the mock environment.

**Impact**: Tests may accept files that would fail for non-bot users.

### Video Dimensions

| Feature | Status | Notes |
|---------|--------|-------|
| Video width/height | ❌ | Not extracted |

**Reason**: Would require a video parsing library (e.g., ffprobe bindings). Discord.js doesn't typically need video dimensions for testing.

**Impact**: Video attachments won't have `width`/`height` populated.

---

## Spec Deviations (Intentional)

### None

The implementation does not deviate from Discord's specification. All implemented features follow Discord's documented behavior.

---

## Verification Checklist

### Does the implementation match Discord exactly?

- ✅ Attachment ID format (Snowflake)
- ✅ URL structure (`/attachments/{channel}/{attachment}/{filename}`)
- ✅ Content-Disposition behavior (inline vs attachment)
- ✅ Spoiler prefix handling (`SPOILER_`)
- ✅ Description max length (1024)
- ✅ File count limit (10)
- ✅ Total size limit (25MB)
- ✅ Error codes (50035, 40005)
- ✅ Image dimension extraction (PNG, JPEG, GIF, WebP)

### Known Discord Behaviors We Match

1. **Attachment IDs in edits**: When editing a message, Discord uses string IDs for existing attachments and numeric indices for new files. We handle both.

2. **Attachment cleanup**: When a message is deleted, associated attachment data is cleaned up. We do this.

3. **CDN caching**: Discord uses long cache times (1 year). We set the same header.

4. **UTF-8 filenames**: Discord uses RFC 5987 for encoding non-ASCII filenames. We do too.

---

## Test Coverage

All spec-compliant features are covered by tests in `__tests__/attachments.test.ts`:

- Multipart parsing (8 tests)
- Image dimension detection (7 tests)
- Storage operations (13 tests)
- Spoiler detection (3 tests)
- Description validation (4 tests)
- Constants validation (2 tests)
- Storage interface (9 tests)
- Requirements verification (6 tests)

**Total: 52 tests**

---

## References

- [Discord API Attachment Object](https://discord.com/developers/docs/resources/message#attachment-object)
- [Discord API Attachment Flags](https://discord.com/developers/docs/resources/message#attachment-object-attachment-flags)
- [Discord API Message Create](https://discord.com/developers/docs/resources/message#create-message)
