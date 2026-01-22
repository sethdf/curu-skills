---
name: SimpleX
description: SimpleX Chat secure messaging via simplex-chat CLI. USE WHEN sending simplex messages, checking simplex, secure messaging without identifiers, private communication, OR mobile bridge. Invoke with /simplex.
---

## Customization

**Before executing, check for user customizations at:**
`~/.claude/skills/CORE/USER/SKILLCUSTOMIZATIONS/SimpleX/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.

# SimpleX

CLI-first SimpleX Chat integration for maximum privacy messaging. No phone numbers, no user IDs - just cryptographic keys.

## Quick Start

```bash
/simplex                       # Show recent chats
/simplex send "msg"            # Send to default contact
/simplex send @contact "msg"   # Send to named contact
/simplex bridge                # Start mobile-to-PAI bridge
```

## Why SimpleX

- **No identifiers** - No phone number, email, or username required
- **Metadata resistant** - Servers don't know who talks to whom
- **E2E encrypted** - Double ratchet encryption
- **Decentralized** - Can self-host servers
- **Great iOS app** - Full-featured mobile client

## Backend

Uses `simplex-chat` CLI directly. Database stored at `~/.simplex/`.

## Quick Reference

```bash
# Show recent chats
simplex-chat -e '/chats' -t 2

# List contacts
simplex-chat -e '/contacts' -t 2

# Send message to contact
simplex-chat -e '@contact_name Your message here' -t 2

# Create new contact invitation
simplex-chat -e '/connect' -t 2

# Accept invitation
simplex-chat -e '/connect <invitation_link>' -t 5

# Show your address (for others to connect)
simplex-chat -e '/address' -t 2

# Receive pending messages
simplex-chat -e '/tail' -t 5
```

## Workflow Routing

| Workflow | Trigger | File |
|----------|---------|------|
| **Setup** | "setup simplex", "connect simplex" | `Workflows/Setup.md` |
| **Check** | "/simplex", "check simplex messages" | `Workflows/Check.md` |
| **Send** | "/simplex send" | `Workflows/Send.md` |
| **Bridge** | "simplex bridge", "mobile bridge" | `Workflows/Bridge.md` |

## Contact References

Contacts are referenced by display name with `@` prefix:
- `@alice` - Send to contact named "alice"
- `@'SimpleX Status'` - Names with spaces need quotes

Get contact list:
```bash
simplex-chat -e '/contacts' -t 2
```

## Examples

**Example 1: Check messages**
```
User: "/simplex"
-> Runs simplex-chat -e '/chats' -t 2
-> Shows recent conversations
-> Lists contacts with new messages
```

**Example 2: Send message to contact**
```
User: "/simplex send @alice 'Meeting moved to 3pm'"
-> Runs simplex-chat -e "@alice Meeting moved to 3pm" -t 2
-> Returns send confirmation
```

**Example 3: Create connection invite**
```
User: "/simplex connect"
-> Runs simplex-chat -e '/connect' -t 2
-> Returns one-time invitation link
-> Link can be shared out-of-band
```

**Example 4: Start mobile bridge**
```
User: "/simplex bridge"
-> Starts simplex-bridge listener
-> Routes incoming messages through PAI
-> Enables mobile-to-Claude communication
```

## Mobile Bridge Integration

The SimpleX Bridge (`simplex-bridge-pack`) enables mobile-to-PAI communication:

1. **Send message from phone** via SimpleX iOS app
2. **Bridge receives** and routes through Haiku for context detection
3. **Claude Code executes** the request
4. **Response sent back** through SimpleX

```bash
# Start bridge
simplex-bridge.sh listen

# Test routing
simplex-bridge.sh test "What's on my calendar?"
```

Configuration: `~/.config/simplex-bridge/config.yaml`

## Archive & Sync

SimpleX stores all messages locally in SQLite:

```bash
# Database location
~/.simplex/simplex_v1_chat.db
~/.simplex/simplex_v1_agent.db

# Export messages (JSON)
sqlite3 ~/.simplex/simplex_v1_chat.db \
  "SELECT * FROM messages ORDER BY created_at DESC LIMIT 50;"
```

For libretto integration, messages can be exported periodically.

## Error Handling

| Error | Cause | Solution |
|-------|-------|----------|
| `Database locked` | Another simplex-chat running | Kill other instance |
| `Connection failed` | Network/server issue | Check internet, retry |
| `Contact not found` | Typo in contact name | Use `/contacts` to verify |
| `Timeout` | Slow response | Increase `-t` timeout |

## CLI Reference

| Command | Description |
|---------|-------------|
| `/chats` | List recent conversations |
| `/contacts` | List all contacts |
| `/connect` | Create invitation link |
| `/connect <link>` | Accept invitation |
| `/address` | Show your contact address |
| `/profile` | View/edit profile |
| `@name msg` | Send message to contact |
| `/file name ./path` | Send file to contact |
| `/group name` | Create new group |
| `/tail` | Show recent messages |
| `/quit` | Exit chat |

## Security Notes

- **Local encryption** - Database encrypted with key from `-k` flag
- **No central server** - Messages relay through SMP servers but are E2E encrypted
- **Ephemeral** - Invitation links are one-time use
- **Self-host option** - Can run own SMP/XFTP servers
