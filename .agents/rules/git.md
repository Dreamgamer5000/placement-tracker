# Git Rules & Permissions

## Git Commit & History Policy
- **No Autonomous Commits:** The agent is strictly forbidden from running `git commit`, `git push`, `git merge`, `git rebase`, or modifying git history on its own.
- **Explicit User Confirmation Required:** The agent MUST explicitly ask the user for permission and receive approval in the prompt before executing any `git commit` or `git push` command.
- **Pre-Commit Review:** When proposing a commit, summarize the staged files and the proposed commit message to the user for review first.
