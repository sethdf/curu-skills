# Suggest Workflow

Analyze assigned tickets and recommend which one to work on next.

## Step 1: Fetch All Open Tickets

Use MyTickets workflow logic to get all assigned open tickets.

## Step 2: Scoring Algorithm

Score each ticket based on:

| Factor | Weight | Scoring |
|--------|--------|---------|
| **Overdue** | 40 | +40 if overdue, +10 per day overdue (max 80) |
| **Priority** | 25 | Urgent=25, High=20, Medium=10, Low=5 |
| **Due Soon** | 20 | +20 if due today, +15 if due tomorrow, +10 if due this week |
| **VIP Requester** | 10 | +10 if requester is marked VIP |
| **Waiting Time** | 5 | +1 per day since last update (max 10) |

## Step 3: Calculate Scores

```python
def score_ticket(ticket):
    score = 0

    # Overdue factor
    if ticket.is_overdue:
        score += 40
        score += min(ticket.days_overdue * 10, 40)

    # Priority factor
    priority_scores = {"Urgent": 25, "High": 20, "Medium": 10, "Low": 5}
    score += priority_scores.get(ticket.priority, 5)

    # Due soon factor
    if ticket.due_today:
        score += 20
    elif ticket.due_tomorrow:
        score += 15
    elif ticket.due_this_week:
        score += 10

    # VIP factor
    if ticket.requester_is_vip:
        score += 10

    # Waiting time factor
    score += min(ticket.days_since_update, 10)

    return score
```

## Step 4: Rank and Present

Sort tickets by score descending.

## Step 5: Output Recommendation

```
## Recommended Next Ticket

**#12345 - Server not responding**
- Score: 87/100
- Reason: Overdue by 2 days, High priority, VIP requester

### Why this ticket?
1. Overdue by 2 days (+60 points)
2. High priority (+20 points)
3. VIP requester (CFO) (+10 points)

### Suggested Actions
1. Review ticket history
2. Check related tickets for patterns
3. Update requester with status

---

## Runner Up Tickets

| Rank | ID | Subject | Score | Key Factor |
|------|-----|---------|-------|------------|
| 2 | #12346 | Email not syncing | 65 | Due today |
| 3 | #12340 | Password reset | 45 | Medium priority, 3 days old |
```

## Output

Return top recommendation with reasoning, plus ranked alternatives.
