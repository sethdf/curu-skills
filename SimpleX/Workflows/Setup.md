# Setup Workflow

Set up SimpleX Chat CLI and connect with contacts.

## Prerequisites

- `simplex-chat` CLI installed at `~/.local/bin/simplex-chat`
- Database initialized at `~/.simplex/`

## Step 1: Verify Installation

```bash
simplex-chat --version
```

Expected: `SimpleX Chat v6.x.x`

## Step 2: Check Current User

```bash
simplex-chat -e '/profile' -t 2
```

Shows current user profile. If no profile exists, you'll be prompted to create one.

## Step 3: Create Contact Invitation

To add a new contact:

```bash
simplex-chat -e '/connect' -t 2
```

This outputs a one-time invitation link like:
```
simplex:/contact#/?v=2&smp=...
```

**Share this link with your contact via:**
- Another secure channel (Signal, in-person, etc.)
- QR code (for mobile scanning)

## Step 4: Accept Contact Invitation

If someone shares their invitation with you:

```bash
simplex-chat -e '/connect simplex:/contact#/?v=2&smp=...' -t 5
```

Wait for connection confirmation.

## Step 5: Create Your Address

For a persistent contact address (reusable, unlike one-time invites):

```bash
simplex-chat -e '/address' -t 2
```

This creates a permanent address others can use to contact you.

## Step 6: Connect with PAI Bridge

To set up mobile-to-PAI communication:

1. Install SimpleX app on iOS/Android
2. Create connection from phone to CLI:
   - On CLI: `simplex-chat -e '/connect' -t 2`
   - On phone: Scan or paste the invitation
3. Name the contact (e.g., "PAI Bridge")

## Step 7: Verify Connection

```bash
simplex-chat -e '/contacts' -t 2
```

Should show your new contact.

Test with:
```bash
simplex-chat -e '@contact_name Hello from CLI!' -t 2
```

## Configuration

### Database Location

Default: `~/.simplex/simplex_v1`

Override with `-d` flag:
```bash
simplex-chat -d /path/to/custom_db
```

### Encryption Key

Add database encryption:
```bash
simplex-chat -k "your-encryption-key"
```

Store key securely in BWS:
```bash
bws secret create simplex-db-key "your-encryption-key"
```

### Custom SMP Servers

Use your own servers:
```bash
simplex-chat -s "smp://your-server.example.com"
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Profile not created | Run simplex-chat interactively first |
| Connection timeout | Increase `-t` timeout, check network |
| Database locked | Kill other simplex-chat processes |
| Invitation expired | Create new invitation with `/connect` |

## Output

Confirm setup complete with:
- Profile created
- At least one contact connected
- Messages can be sent/received
