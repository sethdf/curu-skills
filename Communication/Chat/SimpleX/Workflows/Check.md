# Check Workflow

Check SimpleX messages and recent activity.

## Step 1: Show Recent Chats

```bash
simplex-chat -e '/chats' -t 3
```

Output shows:
- Contact name
- Preview of last message
- Unread indicator (if any)

## Step 2: Show Contacts

```bash
simplex-chat -e '/contacts' -t 2
```

Lists all connected contacts with display names.

## Step 3: Get Recent Messages (Optional)

To see actual message content from a specific contact:

```bash
simplex-chat -e '/tail @contact_name 10' -t 3
```

Shows last 10 messages with that contact.

## Step 4: Format Output

Present results in a clear format:

```markdown
## SimpleX Status

**User:** curu
**Contacts:** 3 connected

### Recent Activity

| Contact | Last Message | Time |
|---------|--------------|------|
| @alice | "See you tomorrow" | 2 hours ago |
| @bob | "Thanks for the file" | Yesterday |

### Pending
- No unread messages
```

## Notes

- Messages are E2E encrypted and stored locally
- `/chats` shows conversation previews
- `/tail` shows full message history
- Use `@contact_name` to interact with specific contacts
