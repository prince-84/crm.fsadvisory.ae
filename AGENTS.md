# Agent Instructions & Operating Rules for FS Advisory CRM

## 1. Mandatory README.md Documentation Updates
Whenever you complete work, add features, modify database schemas, build/adjust UI components, or implement workflows in this project, you **MUST ALWAYS update [README.md](file:///d:/FSadvisory-crm/README.md)** with:
- Detailed technical descriptions of what was implemented.
- Updated module/feature bullet points.
- Any newly added files or directory additions in the repository tree.
This rule is non-negotiable. Never complete a user's multi-step task without ensuring `README.md` reflects the current state of the codebase.

## 2. Git Constraints
- **CRITICAL**: **NEVER EXECUTE `git push`** under any circumstances unless the user explicitly and directly commands you to push in that exact prompt.

## 3. Real Estate Domain Rules
- **Contact Permanency**: `Contact` records in Lead Pool are permanent master profiles and are never deleted when opportunities are created.
- **Single Ownership**: Active opportunities have exactly one `current_owner_name`.
- **Mandatory Fields**: Client Name, Primary Phone Number, and Email Address.
- **Action Columns**: Table Action columns (`Actions`) on Lead Pool, Owner Data, and My Queue are permanent, mandatory, and excluded from column toggle dropdowns.
- **Created Date**: `Created Date` (`created_at`) is enabled by default across Lead Pool, Owner Data, and My Queue (both Regular and Owner tabs) and formatted with both Date and Time (`YYYY-MM-DD HH:mm`).
