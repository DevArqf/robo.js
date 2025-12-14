/**
 * Jest Test Setup for Integration Tests
 *
 * This file runs before each test file in the test environment.
 * It configures settings needed for voice gateway testing.
 */

// Allow self-signed certificates for voice gateway testing
// This is required because our mock voice gateway uses self-signed certs
// and @discordjs/voice always connects via wss://
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
