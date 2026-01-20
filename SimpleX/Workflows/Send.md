# Send Workflow

Send messages through SimpleX Chat.

## Input Parameters

- `contact` - Contact name (with `@` prefix) or default
- `message` - Message content to send

## Step 1: Validate Contact

If contact not specified, check for default:

```bash
# List contacts to verify
simplex-chat -e '/contacts' -t 2
```

## Step 2: Format Message

The message format is:
```
@contact_name Your message here
```

For contacts with spaces in name:
```
@'Contact Name' Your message here
```

## Step 3: Send Message

```bash
simplex-chat -e '@contact_name Your message content' -t 3
```

## Step 4: Confirm Delivery

Check the command output for confirmation. SimpleX shows:
- Message sent indicator
- Timestamp

## Examples

### Send to named contact
```bash
simplex-chat -e '@alice Meeting at 3pm' -t 2
```

### Send to contact with spaces in name
```bash
simplex-chat -e "@'PAI Bridge' Task completed successfully" -t 2
```

### Send multi-line message
```bash
simplex-chat -e '@alice Here is the update:
- Item 1 complete
- Item 2 in progress
- Item 3 pending' -t 2
```

## Step 5: Output Confirmation

```markdown
Message sent to @alice at 2026-01-19 21:45:00

**To:** alice
**Message:** Meeting at 3pm
**Status:** Delivered
```

## File Sending

To send a file:

```bash
simplex-chat -e '/file alice ./document.pdf' -t 10
```

Files are transferred via XFTP (encrypted file transfer).

## Error Handling

| Error | Cause | Solution |
|-------|-------|----------|
| Contact not found | Wrong name | Check `/contacts` |
| Message failed | Network issue | Retry |
| Timeout | Large file or slow connection | Increase timeout |
