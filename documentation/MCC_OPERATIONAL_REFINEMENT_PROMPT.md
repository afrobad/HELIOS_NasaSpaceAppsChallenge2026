# HELIOS MCC Operational UX & Information Architecture Refinement Prompt

You are working on HELIOS, an AI-assisted mission control / astronaut health monitoring system.

You are acting simultaneously as:

1. Senior Mission Control Center UX designer
2. Senior operational dashboard designer
3. Senior information-architecture engineer
4. Senior frontend engineer
5. Human-factors / situational-awareness specialist
6. Senior data visualization engineer

You have 20+ years of experience designing interfaces where operators must detect abnormal conditions quickly, understand what is affected, investigate evidence, and make decisions under time pressure.

IMPORTANT:
Do NOT redesign HELIOS from scratch.
Do NOT replace the current visual identity.
Do NOT turn this into a futuristic sci-fi dashboard.
Do NOT add decorative UI just to make it look impressive.

Your job is to improve the CURRENT MCC implementation substantially while preserving its existing visual language.

==================================================
PRIMARY OBJECTIVE
==================================================

Transform the current MCC dashboard into a calm, highly scannable Mission Control Center interface where an operator can:

1. Determine mission state immediately.
2. Identify the most important active problem immediately.
3. Determine what crew/system is affected.
4. Understand whether the condition is improving, stable, or worsening.
5. See the most important supporting evidence.
6. Investigate the event without being overwhelmed.
7. Reach the appropriate decision-support information quickly.
8. Navigate between detailed screens without losing context.

The target is:

"Understand the situation in less than 60 seconds."

The interface must prioritize operational clarity over information density.

The user should never need to read paragraphs to understand what is happening.

==================================================
CURRENT VISUAL IDENTITY TO PRESERVE
==================================================

KEEP THE CURRENT HELIOS MCC VISUAL LANGUAGE.

The existing theme is based on:

- black / near-black background
- charcoal / dark gray surfaces
- olive-gray structural tones
- muted green for nominal/healthy states
- restrained amber for attention/warning
- restrained red for critical conditions
- subtle neutral borders
- compact professional typography
- dense but breathable layout
- no decorative glow
- no excessive gradients
- no glassmorphism
- no neon cyberpunk aesthetic
- no unnecessary rounded cards
- no giant typography
- no excessive icons
- no visual gimmicks

DO NOT change the overall theme to blue.

The existing olive-gray-black-green direction must remain.

You may refine:
- spacing
- typography hierarchy
- border contrast
- surface hierarchy
- component sizing
- alignment
- information grouping
- color intensity
- navigation
- visual priority

But the final result must still clearly look like the same HELIOS product.

==================================================
CORE HUMAN-FACTORS PRINCIPLE
==================================================

Design the MCC around this sequence:

DETECT
↓
IDENTIFY
↓
UNDERSTAND
↓
INVESTIGATE
↓
DECIDE

The interface should visually guide the operator through this sequence.

Do not treat the dashboard as a collection of independent cards.

Treat it as an operational workflow.

Every element must justify its existence by helping the operator:

- detect a condition
- understand a condition
- identify an affected entity
- investigate evidence
- make or support an operational decision

If an element does not contribute to one of those functions, move it to a secondary screen or remove it.

==================================================
MAJOR PROBLEM TO FIX #1
ALARM SATURATION
==================================================

The current Overview contains too much repeated red/critical emphasis.

For example, if four crew members are affected, do NOT make the entire interface look like four independent emergencies.

Avoid:

CRITICAL
CRITICAL
CRITICAL
CRITICAL

with red borders everywhere.

This destroys visual prioritization.

Instead, detect whether the events are related.

If multiple crew members share a similar abnormality, visually group them into ONE operational event.

Example:

ACTIVE ATTENTION

CREW HEALTH
4 / 4 CREW AFFECTED

HR      132 bpm     ↑69%
SpO₂    89.5%       ↓8.5%

TREND       WORSENING
DURATION    00:48

[ INVESTIGATE ]

Then show affected crew below as supporting information.

Use red primarily for:
- critical state
- critical value
- critical indicator

Do NOT make every surrounding border red.

Red must retain meaning.

==================================================
MAJOR PROBLEM #2
REMOVE INFORMATION DUPLICATION
==================================================

The current Overview repeats crew information in:

- Active Events
- Crew cards
- Key trends
- Other summary areas

Reduce duplication.

Overview should answer:

"WHAT IS HAPPENING?"

Crew screen should answer:

"WHAT EXACTLY IS HAPPENING TO EACH CREW MEMBER?"

Systems should answer:

"COULD A SPACECRAFT / ENVIRONMENTAL SYSTEM BE RELATED?"

Comms should answer:

"WHAT IS THE COMMUNICATION STATE AND WHAT DELAY EXISTS?"

Investigate should answer:

"WHY IS THIS HAPPENING AND WHAT EVIDENCE SUPPORTS THE INTERPRETATION?"

Do not show full detailed crew analysis on Overview.

Use progressive disclosure.

==================================================
MAJOR PROBLEM #3
CREATE A STRONG VISUAL CENTER OF GRAVITY
==================================================

The current Overview gives too many components approximately equal visual importance.

Fix this.

The operator's eye should naturally move:

MISSION STATE
↓
ACTIVE ATTENTION
↓
AFFECTED ENTITY
↓
KEY SIGNALS
↓
TREND / TRAJECTORY
↓
SUPPORTING SYSTEM STATE
↓
ACTION

The most important active event should visually dominate the page.

Do not create a grid where every card has equal importance.

==================================================
OVERVIEW SCREEN
==================================================

Redesign the existing Overview while keeping its current visual language.

Recommended hierarchy:

--------------------------------------------------
TOP HEADER
--------------------------------------------------

HELIOS
Live

Dashboard
Health
MCC

Mission Time
UTC
Mission State

Keep this clean.

Remove unnecessary visual competition from the header.

Do not allow secondary tools such as:
- 3D hologram
- scenarios
- experimental controls
- technical development controls

to compete with mission state.

Those belong in secondary areas.

--------------------------------------------------
MCC LOCAL NAVIGATION
--------------------------------------------------

Use short, easy-to-scan labels:

Overview
Crew
Systems
Comms
Investigate

Avoid excessively long tab labels.

Do not use labels such as:

"Event Investigation & Decision Support"

Use:

"Investigate"

The page title can provide additional explanation.

--------------------------------------------------
MISSION STATE
--------------------------------------------------

Show a compact mission-level state.

Example:

MISSION
● ATTENTION

Do not make this unnecessarily large.

--------------------------------------------------
ACTIVE ATTENTION
--------------------------------------------------

This should be the dominant section.

Show only the most important current event or event group.

Structure:

ACTIVE ATTENTION

[SEVERITY]

EVENT NAME

Affected:
4 / 4 Crew

Primary signal:
HR 132 bpm
↑69% baseline

Secondary signal:
SpO₂ 89.5%
↓8.5%

Duration:
00:48

Trajectory:
↑ WORSENING

Related:
Respiration ↑

Action:

[ INVESTIGATE ]

Do NOT use paragraphs.

Use compact labels and strong numeric hierarchy.

--------------------------------------------------
AFFECTED CREW
--------------------------------------------------

After the main event, show affected crew in a compact structure.

Example:

CREW

CREW-01   CRITICAL
CREW-02   CRITICAL
CREW-03   CRITICAL
CREW-04   CRITICAL

Only show the most relevant metrics.

Do not reproduce the entire Crew screen here.

Allow clicking a crew member to open the Crew screen with that crew member selected.

--------------------------------------------------
MISSION SYNOPTIC
--------------------------------------------------

Keep a simple system-level overview.

Use:

CREW       ● ATTENTION
ECLSS      ● NOMINAL
POWER      ● NOMINAL
THERMAL    ● NOMINAL
COMMS      ● NOMINAL

Avoid turning every subsystem into a large card.

The purpose is comparison.

The operator should immediately see:

"One subsystem is abnormal while the others remain nominal."

--------------------------------------------------
KEY SIGNALS
--------------------------------------------------

Show only the most decision-relevant signals.

Example:

HR
132 bpm
↑69%

SpO₂
89.5%
↓8.5%

CO₂
1.80 mmHg
→ Stable

LINK
35.1 dB
→ Stable

Use tiny sparklines where appropriate.

Do not call something a "trend" if there is no visible trend.

--------------------------------------------------
COMMS SUMMARY
--------------------------------------------------

Keep communication information compact on Overview.

Example:

COMMS
● NOMINAL

DSS-63
22m 14s one-way

Data
LIVE · 10 Hz

The full communication analysis belongs in Comms.

==================================================
CREW SCREEN
==================================================

The Crew screen should provide detailed human-health analysis.

Structure:

CREW STATUS
↓
CREW SELECTION
↓
CURRENT VITALS
↓
PERSONAL BASELINE
↓
DEVIATION
↓
TREND
↓
CORRELATED SIGNALS
↓
BIOMARKERS
↓
MEDICAL / OPERATIONAL CONTEXT

For each selected crew member show:

- HR
- SpO₂
- respiration
- temperature
- HRV if available
- workload if available
- relevant calculated biomarkers if actually available in the repository

Always distinguish:

CURRENT VALUE
BASELINE
DEVIATION
TREND

Do not mix these concepts.

Example:

HEART RATE

132 bpm
Baseline 78
↑69%

TREND
Increasing

This is much more useful than a sentence.

==================================================
SYSTEMS SCREEN
==================================================

Organize spacecraft/environmental systems into operational groups.

Include only data actually available in the repository.

Potential sections:

ECLSS
POWER
THERMAL
AVIONICS
CONSUMABLES
RADIATION

For each important parameter prefer:

CURRENT
LIMIT
MARGIN
TREND

Example:

CABIN CO₂

1.80 mmHg

Limit
3.00 mmHg

Margin
1.20 mmHg

Trend
→ Stable

Do not invent values.

Do not create fake telemetry.

Use repository data wherever available.

==================================================
COMMS SCREEN
==================================================

Build a focused deep-space communications screen.

Show available information such as:

- DSN station
- link state
- distance
- one-way light time
- round-trip delay
- signal quality
- frequency/band if available
- data freshness
- communication availability
- blackout/conjunction state if represented in the data

Use a clean operational hierarchy.

Do not fill the page with technical prose.

Example:

LINK STATE
● LOCKED

STATION
DSS-63

DISTANCE
400.2M km

ONE-WAY
22m 14s

ROUND TRIP
44m 29s

DATA
LIVE · 10 Hz

The communication delay must be visually obvious because it directly affects operational decision timing.

==================================================
INVESTIGATE SCREEN
==================================================

This is the most important secondary screen.

When the operator clicks an event from Overview, open Investigate with that event already selected.

Do not make the operator search for it again.

The screen should answer:

WHAT CHANGED?
WHEN?
HOW LARGE?
HOW LONG?
WHAT CHANGED WITH IT?
WHAT SYSTEMS ARE NORMAL?
WHAT IS THE TRAJECTORY?
WHAT EVIDENCE SUPPORTS THE INTERPRETATION?

Use this structure:

EVENT SUMMARY

CREW-02
HR EXCURSION

Current
132 bpm

Baseline
82 bpm

Deviation
+31.7%

Duration
08:12

Trajectory
↑ Increasing


TIMELINE

14:24
HR begins rising

14:26
Respiration increases

14:28
SpO₂ begins falling

14:31
Workload increases

14:32
Current


SIGNAL CORRELATION

HR              ↑
Respiration     ↑
SpO₂             ↓
Workload        ↑
CO₂              →
Temperature      →

SYSTEM CONTEXT

ECLSS       ● NOMINAL
POWER       ● NOMINAL
THERMAL     ● NOMINAL
COMMS       ● NOMINAL


DECISION SUPPORT

Observed:
HR increase
Respiration increase
SpO₂ decrease

Related:
Workload increase

Possible interpretation:
Cardiovascular / physiological stress pattern

Confidence:
92%

Suggested checks:

1. Verify crew status
2. Review recent workload
3. Check environmental trend
4. Review relevant procedure

[ OPEN PROCEDURE ]

Important:

Do not present AI interpretation as an unquestionable fact.

Clearly separate:

OBSERVED
CALCULATED
CORRELATED
INTERPRETED
SUGGESTED

This is critical for operational trust.

==================================================
DATA HONESTY
==================================================

Before redesigning components, inspect the existing repository.

Analyze:

- data/
- nasa_osdr/
- nasa_astronaut_baselines.json
- astronaut telemetry streams
- backend
- app
- core
- scripts
- computational biomarker calculations
- telemetry generation
- existing APIs
- existing data schemas
- existing alert logic
- latency calculations
- ECLSS calculations
- existing scenario/simulation logic

Do not invent new data simply to fill a UI component.

If a metric does not exist:
- do not fabricate it
- do not create fake scientific values
- either omit it or clearly label it as unavailable

Reuse the existing calculations and data pipeline wherever possible.

Preserve functional behavior.

Do not replace working data logic with static mock values.

==================================================
SIGNAL PRESENTATION
==================================================

Make signal labels extremely clear.

Use short labels:

HR
SpO₂
RESP
TEMP
HRV
CO₂
O₂
PRESS
POWER
THERMAL
LINK
SNR

Avoid unnecessarily long labels.

Use:

HR
132 bpm
↑69%

instead of:

Heart Rate (beats per minute)
Current value: 132
Deviation from personal baseline: +69%

The detailed explanation can appear when investigating.

==================================================
VISUAL HIERARCHY
==================================================

Use three levels of information.

LEVEL 1:
Immediate operational state.

Examples:
CRITICAL
ATTENTION
NOMINAL
WORSENING

LEVEL 2:
Important values.

Examples:
132 bpm
89.5%
22m 14s

LEVEL 3:
Context.

Examples:
Baseline 82
Limit 120
Duration 08:12

Do not give Level 3 the same visual weight as Level 1.

==================================================
COLOR SYSTEM
==================================================

Keep the existing olive-gray-black-green theme.

Use color sparingly.

NOMINAL:
Muted green

ATTENTION:
Muted amber

CRITICAL:
Muted red

INFORMATION:
Neutral gray / olive-gray

Do NOT use color for decoration.

Do NOT use gradients for state communication.

Do NOT use glowing borders.

Do NOT use neon green.

Do NOT make every label colored.

Most of the interface should remain neutral.

Color should tell the operator where to look.

==================================================
REMOVE VISUAL FOG
==================================================

Specifically identify and reduce:

- duplicate information
- unnecessary cards
- excessive borders
- excessive badges
- long labels
- long sentences
- redundant headings
- repeated crew metrics
- decorative icons
- excessive color
- unnecessary technical metadata
- scenario controls on operational screens
- development/debug UI
- unnecessary empty widgets
- redundant mission state indicators

Do not simply shrink everything.

Reorganize it.

==================================================
CARDS
==================================================

Do not remove cards completely.

Use cards only when they create meaningful grouping.

Avoid:

CARD
CARD
CARD
CARD
CARD
CARD

Instead create clear visual groups.

Use borders subtly.

Avoid heavy shadows.

Avoid glow.

Avoid excessive corner radius.

Avoid making every component look like a floating object.

==================================================
TYPOGRAPHY
==================================================

Prioritize readability.

Use:

small uppercase/compact label
↓
strong value
↓
small contextual information

Example:

HEART RATE

132 bpm
↑69% baseline

Do not use excessively futuristic fonts.

Do not use decorative typography.

Do not make headings enormous.

Do not use all-caps for entire sentences.

==================================================
SPACING
==================================================

The interface should feel dense enough for MCC use but breathable.

Use:

- consistent spacing scale
- clear group separation
- tighter spacing within related data
- larger spacing between unrelated groups

Do not fill empty space just because it exists.

Empty space is useful.

==================================================
ALERT PRIORITIZATION
==================================================

Implement a clear priority model.

CRITICAL:
Requires immediate operator attention.

ATTENTION:
Requires investigation/monitoring.

ADVISORY:
Informational condition.

NOMINAL:
No active concern.

If multiple alerts are related, group them.

If multiple alerts are unrelated, maintain separate events.

Sort events by operational relevance, not simply by database order.

==================================================
EVENT INTERACTION
==================================================

Clicking an event should:

1. select the event
2. preserve mission context
3. navigate to Investigate
4. show the event timeline
5. show related signals
6. show affected crew/system
7. show supporting evidence
8. provide relevant procedure/action references if available

Do not force the operator to manually reconstruct the event.

==================================================
NO DECORATIVE SCI-FI
==================================================

This is extremely important.

Do NOT add:

- holographic effects
- glowing circles
- animated radar
- decorative orbital animations
- excessive HUD elements
- floating particles
- neon lines
- fake spacecraft diagrams
- meaningless graphs
- excessive animated counters
- fake AI visualizations

HELIOS should feel like serious operational software.

The sophistication should come from:

DATA
LOGIC
CORRELATION
HIERARCHY
CLARITY

not decoration.

==================================================
NO AI SLOP
==================================================

Avoid common AI-generated dashboard problems:

- too many cards
- too many gradients
- excessive blue/cyan
- random icons
- huge rounded containers
- excessive badges
- meaningless charts
- giant titles
- redundant metrics
- decorative statistics
- excessive uppercase text
- fake technical terminology
- paragraphs inside dashboards
- visually equal importance for every element

If a component does not improve operational understanding, remove it.

==================================================
RESPONSIVE / SCREEN SIZE
==================================================

Prioritize desktop MCC displays.

Design for large desktop screens first.

Maintain:

- stable grid
- readable density
- no unnecessary horizontal scrolling
- no cramped cards
- predictable alignment

For smaller screens, collapse logically rather than simply shrinking everything.

==================================================
FUNCTIONALITY
==================================================

Do not make this purely visual.

Ensure:

- navigation works
- tabs work
- event selection works
- crew selection works
- investigation context persists
- data updates correctly
- charts reflect actual data
- status indicators reflect actual state
- existing APIs continue working
- existing calculations continue working
- no fake values are introduced

If functionality already exists, preserve it.

If the UI currently displays hardcoded demonstration values but corresponding real data exists in the repository, connect the UI to the real data.

==================================================
ANALYZE BEFORE MODIFYING
==================================================

Before changing the code:

1. Inspect the existing project structure.
2. Identify the current MCC components.
3. Identify the data sources.
4. Identify existing state management.
5. Identify existing API/data fetching.
6. Identify current telemetry models.
7. Identify existing alert/event logic.
8. Identify existing calculations.
9. Identify existing navigation.
10. Identify which information is duplicated.

Then make a plan.

Do not blindly rewrite the entire application.

Reuse existing components when they are structurally sound.

Refactor only where necessary.

==================================================
IMPLEMENTATION PRIORITY
==================================================

Work in this order:

PHASE 1
Fix information hierarchy.

PHASE 2
Fix alarm prioritization.

PHASE 3
Remove duplication.

PHASE 4
Simplify navigation.

PHASE 5
Create clean Overview.

PHASE 6
Create/refine Crew screen.

PHASE 7
Create/refine Systems screen.

PHASE 8
Create/refine Comms screen.

PHASE 9
Create/refine Investigate screen.

PHASE 10
Polish spacing, typography, borders and colors.

Do not spend most of the effort on visual polish before the information architecture is correct.

==================================================
FINAL QUALITY TEST
==================================================

After implementation, perform an operational UX audit.

Ask:

1. Can I identify the current mission state in 2 seconds?
2. Can I identify the highest-priority event in 5 seconds?
3. Can I identify who/what is affected in 10 seconds?
4. Can I understand the key abnormal signals in 20 seconds?
5. Can I determine whether the condition is improving or worsening?
6. Can I see what systems are still nominal?
7. Can I reach the investigation screen with one action?
8. Can I understand the event timeline?
9. Can I distinguish raw observation from calculated interpretation?
10. Can I reach decision-support information without reading paragraphs?

If any answer is NO, improve the hierarchy rather than adding more information.

==================================================
FINAL DESIGN PHILOSOPHY
==================================================

The final HELIOS MCC should feel:

CALM
PRECISE
QUIET
OPERATIONAL
TRUSTWORTHY
FAST TO SCAN
EVIDENCE-DRIVEN
HUMAN-CENTERED

It should NOT feel:

SCI-FI
GAMIFIED
DECORATIVE
AI-GENERATED
OVERLOADED
NEON
FLASHY

The operator should feel that the interface is helping them think rather than demanding that they interpret the interface.

Most importantly:

DO NOT ADD MORE INFORMATION JUST BECAUSE IT IS AVAILABLE.

Prioritize information according to operational relevance.

The final question for every component is:

"Does this help an MCC operator detect, understand, investigate, or decide faster?"

If not, remove it, move it to a secondary screen, or make it available through progressive disclosure.

Preserve the current HELIOS olive-gray-black-green visual identity while making the MCC substantially cleaner, quieter, more hierarchical, and more operationally useful.
