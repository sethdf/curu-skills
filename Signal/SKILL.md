---
name: Signal
description: Signal secure messaging via signal-cli REST API. USE WHEN sending signal messages, checking signal, secure messaging. Invoke with /signal.
allowed-tools:
  - Bash
  - Read
  - Write
---

# Signal

CLI-first Signal integration using signal-cli-rest-api Docker container. Token-efficient - loads only when invoked.

## Quick Start

```bash
/signal                      # Show recent messages
/signal send "msg"           # Send to self
/signal send +1234567890 "msg"  # Send to number
```

## Backend

Uses `signal-cli-rest-api` Docker container running on `http://127.0.0.1:8080`.

Phone number stored in BWS as `signal-phone`.

## Quick Reference

```bash
# Check status
curl -s http://127.0.0.1:8080/v1/about | jq '.'

# List registered accounts
curl -s http://127.0.0.1:8080/v1/accounts | jq '.'

# Send message
curl -s http://127.0.0.1:8080/v1/send -X POST \
  -H "Content-Type: application/json" \
  -d '{"message":"Hello","number":"+17197152525","recipients":["+17197152525"]}'

# Receive messages
curl -s http://127.0.0.1:8080/v1/receive/+17197152525 | jq '.'
```

## Workflow Routing

| Workflow | Trigger | File |
|----------|---------|------|
| **Setup** | "setup signal", "link signal" | `Workflows/Setup.md` |
| **Check** | "/signal", "check signal" | `Workflows/Check.md` |
| **Send** | "/signal send" | `Workflows/Send.md` |

## Docker Container

The signal-cli-rest-api container must be running:

```bash
# Start container (if not running)
docker start signal-cli-rest-api

# Or create new container
docker run -d --name signal-cli-rest-api \
  --restart unless-stopped \
  -p 127.0.0.1:8080:8080 \
  -v ~/.local/share/signal-cli-rest-api:/home/.local/share/signal-cli \
  -e MODE=native \
  bbernhard/signal-cli-rest-api:latest
```

## Authentication

Signal uses device linking (QR code from primary phone).

```bash
# Generate QR code for linking
curl -s http://127.0.0.1:8080/v1/qrcodelink?device_name=curu-cli -o qr.png

# Check linked accounts
curl -s http://127.0.0.1:8080/v1/accounts
```

## Examples

**Example 1: Check messages**
```
User: "/signal"
-> Fetches recent messages from signal-cli API
-> Shows sender, timestamp, message content
```

**Example 2: Send message to self**
```
User: "/signal send 'Remember: call dentist'"
-> Sends to registered number (self)
-> Returns timestamp confirmation
```

**Example 3: Send to contact**
```
User: "/signal send +15551234567 'Running late'"
-> Sends to specified number
-> Returns timestamp confirmation
```

## Error Handling

| Error | Cause | Solution |
|-------|-------|----------|
| `Connection refused` | Docker container not running | `docker start signal-cli-rest-api` |
| `No registered accounts` | Device not linked | Run setup workflow |
| `Invalid number format` | Missing country code | Use E.164 format: +1234567890 |
| `Rate limited` | Too many messages | Wait and retry |

## API Reference

Base URL: `http://127.0.0.1:8080`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v1/about` | GET | API version info |
| `/v1/accounts` | GET | List linked accounts |
| `/v1/send` | POST | Send message |
| `/v1/receive/{number}` | GET | Receive messages |
| `/v1/qrcodelink` | GET | Get linking QR code |
