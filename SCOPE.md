FS Advisory CRM — Developer Brief
Phase 1: Telesales & Sales Foundation
1. Core CRM Architecture
Build the CRM around this hierarchy:
CONTACT / LEAD BANK
        ↓
OPPORTUNITY
        ↓
ONE CURRENT OWNER
        ↓
PIPELINE + NEXT ACTION
        ↓
SLA TRACKING
        ↓
TELESALES QUALIFICATION
        ↓
SALES HANDOVER
        ↓
SALES PIPELINE
        ↓
WON / LOST
Critical Rule
A Contact is permanent. An Opportunity is transactional.
A contact must never be removed from the Lead Bank when an opportunity is created.
Example:
Ahmed Al Rashidi — Contact
Can have:
Buyer Opportunity #001 — Closed Lost 
Buyer Opportunity #002 — Active 
Seller Opportunity #003 — Future 
The Contact exists only once in the master database.

2. Lead Bank / Contacts Module
The Lead Bank is the master database of all historical and new contacts.
It contains people who have enquired with FS Advisory over the past 3–4 years and all future incoming contacts.
Contact States
A contact can have:
Available — no active opportunity; available for calling/reactivation 
Active — has an active opportunity 
Reactivation — eligible for a new campaign/follow-up 
Do Not Contact 
Duplicate / Merge Required 
Important
Hot / Warm / Cold should not be a permanent Contact status.
Temperature belongs to the Opportunity, not the Contact.

3. Lead Pool UI
The Lead Pool screen should be a high-density CRM table.
Main columns
Contact 
Name 
Initial/avatar 
Nationality 
Phone number 
Source 
Google Ads 
Meta Ads 
Website 
Bayut 
Property Finder 
Referral 
Database, etc. 
Last Activity 
Date/time 
Activity type 
Example: Call · 4m 22s 
Contact State 
Available 
Active 
Reactivation 
Active Opportunity 
Opportunity Type 
Temperature 
Budget/value 
Key requirement 
Current Owner 
Next Action 
SLA 
Actions menu 
Top statistics
Show:
Total Contacts 
Available 
Active Opportunities 
Reactivation Eligible 
Duplicates 
These should act as clickable filters.

4. Contact Record
Clicking a contact should open a right-side drawer.
Do not immediately navigate away from the Lead Pool.
Contact drawer includes
Contact information
Avatar/initials 
Full name 
Nationality 
Languages 
Phone 
Email 
Active Opportunity
If one exists:
Buyer / Seller / Landlord / Tenant 
Hot / Warm / Cold 
Budget 
Requirements 
Score 
Ownership
Current Owner 
Department 
Originating Agent 
Next Action
Action type 
Due date/time 
SLA status 
Recent Activity
Show timeline:
Calls 
WhatsApp 
Emails 
Notes 
Tasks 
Opportunity creation 
Ownership changes 
Main CTA
Open Opportunity
If no active opportunity:
+ Create Opportunity

5. Opportunity Creation
An Opportunity is created when the telesales agent has identified a genuine business requirement.
Initially support:
Buyer 
Seller 
Landlord 
Tenant 
Required fields when creating
At minimum:
Contact 
Opportunity Type 
Current Owner 
Source 
Created Date 
Then launch the relevant qualification workflow.
Do not force the user to complete 30 fields before creating the opportunity.

6. Opportunity Ownership
Critical business rule:
One Opportunity = One Current Owner at any given time.
Example during qualification:
Contact: Ahmed Al Rashidi
Opportunity: Buyer
Current Owner: Mako
Department: Telesales
When handed to Sales:
Contact: Ahmed Al Rashidi
Opportunity: Buyer

Current Owner: Faraz
Department: Sales

Previous Owner: Mako
Originating Agent: Mako
Assigned Sales Advisor: Faraz
The ownership history must always be retained.
Separate fields required
current_owner_id 
originating_agent_id 
assigned_telesales_agent_id 
assigned_sales_advisor_id 
Ownership history/log 

7. Telesales Workflow
The initial workflow should be:
LEAD BANK
   ↓
LEAD ASSIGNED / SELECTED
   ↓
CALL / CONTACT ATTEMPT
   ↓
CALL OUTCOME
   ↓
QUALIFICATION
   ↓
OPPORTUNITY CREATED
   ↓
HOT / WARM / COLD
   ↓
NEXT ACTION + DUE DATE + SLA
   ↓
FOLLOW-UP / APPOINTMENT
   ↓
QUALIFIED FOR HANDOVER
   ↓
HANDOVER TO SALES
Call outcomes should include
No Answer 
Busy 
Callback Requested 
Interested 
Not Interested 
Invalid Number 
Wrong Number 
Do Not Contact 
Qualified 
Follow-up Required 
Every outcome should trigger the appropriate next action.
Example:
Outcome: No Answer
        ↓
System requires:
Next Call Date + Time
        ↓
Creates next task automatically

8. Opportunity Temperature
Temperature is stored against the Opportunity:
🔴 Hot
High intent / urgent / ready to proceed.
🟠 Warm
Interested but requires follow-up/nurturing.
🔵 Cold
Low immediate intent / long-term potential.
⚪ Unqualified
Not enough information yet.
This must be configurable by management in the future.

9. Next Action — Mandatory
Every active opportunity must always have:
Current Owner 
Current Stage 
Next Action 
Next Action Due Date/Time 
SLA 
Activity History 
Example
Current Owner: Mako

Next Action:
Call Client

Due:
10 Aug 2026 · 2:00 PM

SLA Status:
Due Soon
If any active opportunity is missing these fields, flag it as:
ORPHANED OPPORTUNITY
It should appear in a management exception report.

10. SLA Engine
SLA must be based primarily on the Next Action, not simply on whether someone updated the CRM.
This prevents fake activity.
SLA statuses
🟢 On Track 
🟠 Due Soon 
🔴 Overdue / Breached 
Suggested escalation
Before due time
Example: 30 minutes before deadline.
Send reminder to Current Owner.
SLA Breach
At the deadline:
Mark opportunity as overdue 
Show prominently in My Queue 
Record breach 
Notify relevant manager 
Grace period
Example: configurable 15–30 minutes.
Escalation
If still untouched:
Notify manager again 
Allow manager to reassign 
Allow manager to extend SLA 
Allow manager to mark an exception 
Critical leads
For Hot or paid leads, support automatic reassignment after the configured grace period.
The original breach must remain in the agent's performance record.

11. My Queue Module
This is the main daily execution screen for telesales.
The Lead Pool is the database.
My Queue is where agents work.
Queue sections / sorting priority
Overdue 
Due Now 
Hot Leads 
Upcoming Today 
Later 
Completed 
Each item should show:
Contact name 
Opportunity type 
Temperature 
Budget 
Lead score 
Next Action 
Due time 
SLA status 
Quick action button 
Example:
AHMED AL RASHIDI

Buyer · AED 1.8M–2.2M · Score 84
HOT

NEXT ACTION
Call client — confirm appointment

OVERDUE BY 12 MINUTES

[ CALL NOW ]

12. Opportunity Workspace
The Opportunity is the primary working record.
Header
Contact Name 
Opportunity ID 
Opportunity Type 
Temperature 
Score 
Tabs
Overview 
Qualification 
Requirements 
Activity 
Notes 
Documents 
Right-side action panel
Show:
Current Responsibility
Current Owner
Next Action
Action + due date/time + SLA
Opportunity Status
Current stage
Quick actions
Log Call 
WhatsApp 
Email 
Add Note 
Create Task 
Schedule Appointment 
Change Stage 
Hand Over to Sales 
The action area should remain easily accessible.

13. Buyer Qualification Fields
For the first Buyer workflow, capture:
Client Intent
Investor / End User 
Purchase Timeline 
First-time Buyer? Yes/No 
Financial
Minimum Budget 
Maximum Budget 
Cash / Finance 
Payment Plan Preference 
Property Requirements
Community 
Project 
Developer 
Property Type 
Bedrooms 
Qualification
Temperature 
Lead Score 
Qualification Notes 

14. Sales Handover
Handover should be a controlled action.
It should not simply change the owner without validation.
Before handover, define mandatory qualification criteria.
For example:
Contact details verified 
Budget captured 
Timeline captured 
Buyer intent captured 
Requirements captured 
Temperature assigned 
Appointment or sales-ready criteria met 
Once approved:
CURRENT OWNER
Mako → Faraz

DEPARTMENT
Telesales → Sales

ORIGINATING AGENT
Mako remains permanently recorded
Create an activity log entry:
Opportunity handed over from Mako to Faraz.

15. FS Advisory UI Theme
Design direction
Premium, minimal, modern enterprise CRM.
Do not design it as a typical card-heavy dashboard.
Colors
Deep Navy: #1B2A4A 
Warm Ivory: #FAF8F4 
Champagne Gold: #C9A84C 
Soft Charcoal: #2C2C2C 
Stone Grey: #7A7A7A 
White: #FFFFFF 
Border: #E8E2D9 
Operational colors:
Hot/Urgent: #D94F4F 
Warm/Caution: #E8A838 
Cold/Info: #4A7FA5 
Success: #3A7D44 
Typography
Headings / major numbers: Playfair Display 
UI / labels / tables: Inter 
UI principles
Dark navy sidebar 
Warm ivory application background 
White structured surfaces 
Champagne Gold used sparingly 
Fine borders 
Minimal shadows 
Dense tables 
Strong information hierarchy 
No excessive rounded cards 
No excessive use of gold 
Premium and calm, but operationally powerful 
Usage ratio
Approximately:
80%  Ivory / White / Charcoal
15%  Deep Navy
5%   Champagne Gold

Phase 1 Screens to Build
The developer should build these in this order:
01 — Lead Pool
Master contacts database.
02 — Contact Drawer / Contact Profile
Quick intelligence and history.
03 — Create Opportunity
Controlled opportunity creation.
04 — My Queue
Daily telesales action center.
05 — Opportunity Workspace
Qualification and active opportunity management.
06 — Sales Handover
Validation and ownership transfer.
07 — Sales Pipeline
Kanban/table view for sales opportunities.

Final Non-Negotiable Rules
1. Contact is permanent.
2. Contact is never deleted when an Opportunity is created.
3. One Contact can have multiple Opportunities over time.
4. Each Opportunity has only ONE Current Owner at a time.
5. Originating Agent is permanently retained.
6. Hot/Warm/Cold belongs to the Opportunity, not the Contact.
7. Every active Opportunity requires a Next Action and Due Date.
8. SLA is measured against meaningful required actions.
9. SLA breaches must be logged and cannot be silently removed.
10. Every ownership change must have a history record.
11. Telesales → Sales is a controlled handover, not shared ownership.
12. Lead Pool is the database; My Queue is the agent's daily workspace.
This brief gives the developer both the product logic and UI direction needed to start building the FS Advisory CRM correctly.
