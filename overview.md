# B2R Push Notification Platform — Overview

## What does this platform do?

This platform automatically sends a push notification to every eligible buyer on their phone within minutes. No manual work. The right buyers, in the right state, at the right time.

---

## Who uses it?

| Role | What they do |
|---|---|
| **CMT checker** | Logs in, browses products, queues notifications, monitors delivery |
| **Buyer (retailer)** | Receives the push notification on their Android or iOS device |
| **No one** | The actual sending is fully automated — the system handles it |

---

## The four pieces

### 1. Admin Console (the website)
A web app that only works on desktop. CMT checkers log in here to:
- Browse active products with stock
- Write a notification body (e.g. "Now LIVE ₹4,390!") and choose a priority
- Queue one or many notifications at once
- Monitor what's been sent, what's pending, what failed
- Trigger an immediate send ("Send Now") when a product needs urgent push

Access is restricted — only CMT Checker can log in.

### 2. API Server (the brain)
Runs 24/7 in the background. The admin console talks to this, and so does the Linux worker. It:
- Handles login and security
- Stores and retrieves notifications
- Validates products before sending (is it still active? still in stock?)
- Generates smart notification text if none was written (e.g. "Now LIVE ₹2,990! New Arrival")

### 3. Linux Worker (the sender)
Runs on a Linux server. Wakes up every minute and checks the queue. It:
- Picks the highest-priority pending notification
- Verifies the product is still available
- Finds all eligible buyers (filtered by state and registration category)
- Sends to up to 200 buyers at a time via Firebase (Google's push service)
- Retries automatically on network errors

### 4. Windows Worker (the sync)
Runs on the Windows server where buyer data lives. Wakes up every 30 minutes and:
- Finds buyers who have the app installed (have a device token)
- Syncs their tokens to the cloud database
- Removes tokens for buyers who no longer qualify
- Only syncs what changed — very efficient

---

## How a notification gets sent — step by step

```
1. Admin logs in → browses products → selects one → writes body → clicks "Create"

2. Notification sits in the queue with status: Pending

3. Every minute, the Linux worker wakes up and picks the next notification
   (priority order: Urgent (Send Now) → High → Normal → Low, oldest first within each)

4. Worker checks: is the product still active and in stock?
   → No: notification is marked "no stock" or "deactive" — not sent

5. Worker fetches all buyer tokens from the cloud (filtered by state if needed)
   → No buyers: marked "done" with 0 sent

6. Worker sends to buyers in batches of 200 via Firebase
   → Each batch result is recorded (sent count, failed count)

7. Notification marked "done" — visible in the admin console with full stats
```

---

## Priority system

| Priority | When to use | Delivery order |
|---|---|---|
| **Urgent (Send Now)** | Flash deals, time-sensitive stock | First in queue, immediately |
| **High** | Important new arrivals | Second |
| **Normal** | Regular product listings | Third (default) |
| **Low** | Non-urgent campaigns | Last |

Only one "Send Now" notification can be active at a time. If you try to send now while another is already queued, you'll get a warning.

---

## Notification statuses explained

| Status | What it means |
|---|---|
| **Pending** | Waiting in queue, not picked up yet |
| **Processing** | Being sent right now — do not edit or delete |
| **Done** | Successfully completed (sent count may be 0 if no eligible buyers) |
| **No stock** | Product ran out of stock before sending — notification skipped |
| **Deactive** | Product was deactivated before sending — notification skipped |
| **Not found** | Product was deleted — notification skipped |
| **Server error** | Something went wrong |

---

## How app works

**Logging in**
- Desktop browser only — mobile and tablet are blocked by design
- Use your assigned CMT Checker account credentials

**Creating a notification**
- Go to Products → find a product → fill in the notification body → set priority → click "Create Notification"
- You can select multiple products and create all at once

**Sending immediately**
- Open the notification → click "Send Now"
- Only works on Pending notifications
- Only one can be queued for immediate send at a time

**Editing a notification**
- Only possible while status is Pending
- Once it's Locked or Processing, it cannot be changed

**Deleting a notification**
- Possible at any status except Locked and Processing
- A confirmation dialog appears before deletion

**Checking delivery**
- The Notifications page shows sent count, failed count, and batch details
- "Done" with sent_count = 0 means no eligible buyers were found at that time
- Failed counts are normal — some device tokens expire and Firebase rejects them

**Things that are automatic (don't need manual action)**
- Buyer token sync — happens every 30 minutes in the background
- Notification processing — happens every minute automatically
- Body text generation — if you leave the body blank, the system fills it in

---