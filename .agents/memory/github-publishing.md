---
name: GitHub publishing
description: Durable workspace behavior for publishing repositories through the attached GitHub connection.
---

When the local HTTPS Git remote rejects authentication but the GitHub integration is attached, publish through the authenticated GitHub API rather than requesting a token in chat.

**Why:** The workspace Git remote and the attached integration may use separate authentication paths; credentials must remain inside the connector proxy.

**How to apply:** Verify the repository and target branch first, then create the commit/tree through the Git data API and verify the resulting commit on the branch.