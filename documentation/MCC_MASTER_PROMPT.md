# MASTER IMPLEMENTATION PROMPT

## Mission Control Center (MCC) | H.E.L.I.O.S.

You are acting as a senior aerospace software engineer, mission-control UI/UX architect, human-factors engineer, data visualization engineer, and technical documentation engineer with 20+ years of experience designing operational systems.

Your task is to inspect the existing H.E.L.I.O.S repository and independently design and implement a complete Mission Control Center module.

Do not treat this as a normal admin dashboard.

The MCC is the **decision-support layer** between raw telemetry and human mission operators.

The existing system already contains:

* `H.E.L.I.O.S/`
* `data/`
* `nasa_osdr/`
* `backend/`
* `app/`
* `core/`
* `scripts/`
* `computational_biomarkers.py`
* `download_nasa_osdr.py`
* `generate_telemetry_stream.py`
* `astronaut_telemetry_stream.csv`
* `nasa_astronaut_baselines.json`

Inspect the actual repository before changing anything.

Do not assume the existing implementation is correct merely because a feature already exists.

Your first responsibility is to understand the existing architecture, data flow, calculations, components, routes, state management, APIs, and current dashboard behavior.

Then integrate the MCC into the existing system rather than creating an isolated prototype.

---

# 1. PRIMARY OBJECTIVE

Build a professional Mission Control Center that allows an operator to move through this mental workflow:

DATA
→ DETECTION
→ CORRELATION
→ CONTEXT
→ RISK
→ EXPLANATION
→ POSSIBLE ACTIONS
→ HUMAN DECISION

The MCC should answer five questions extremely quickly:

1. What is happening?
2. What changed?
3. How serious is it?
4. Why is it happening?
5. What should the operator evaluate next?

Do not turn the MCC into another telemetry screen.

Telemetry tells the operator what the sensors report.

The MCC interprets those signals into operational context.

---

# 2. CORE HUMAN-FACTORS PRINCIPLE

Design the system according to the spirit and applicable principles of:

* NASA Human Integration Design Handbook (HIDH)
* NASA-STD-3001 Volume 2
* NASA Display Standard, Appendix F
* NASA human-centered telemetry display research
* NASA human-factors and human-in-the-loop design practices

The design must prioritize:

* situation awareness
* low cognitive workload
* clear hierarchy
* fast anomaly recognition
* contextual information
* trend interpretation
* correlation
* explanation of automated analysis
* consistent interaction
* minimal distraction
* readable typography
* operationally meaningful color
* human control over decisions

NASA display guidance specifically emphasizes limiting information to what is needed for task performance or situation awareness, avoiding unnecessary navigation, clearly representing automation state, and explaining automated recommendations and their rationale.

Use those principles as design direction, not as decoration.

---

# 3. DO NOT BUILD AI SLOP

The interface must NOT look like:

* a generic SaaS analytics dashboard
* a cryptocurrency dashboard
* a cyberpunk interface
* a sci-fi movie HUD
* a glowing "AI" interface
* a glassmorphism template
* a dashboard full of cards
* a dashboard full of gradients
* excessive neon
* excessive rounded containers
* oversized icons
* unnecessary illustrations
* decorative 3D spacecraft
* meaningless animations
* huge numbers everywhere
* excessive badges
* excessive colors
* fake NASA-looking graphics
* random charts with no operational purpose

The interface should feel like a serious operational engineering system.

Every visual element must answer:

"Does this help an operator understand the mission or make a decision?"

If not, remove it.

---

# 4. VISUAL DESIGN DIRECTION

Use a dark operational environment because the application represents a Mission Control Center.

However:

Dark does NOT mean black everywhere.

Use:

* deep navy / blue-black background
* slightly lighter surfaces
* subtle borders
* restrained elevation
* readable neutral text
* muted secondary text
* limited status colors

Avoid pure black and excessive contrast.

The interface should be comfortable for prolonged viewing.

Use professional status colors:

GREEN = nominal / healthy

AMBER/YELLOW = warning / attention required

RED = critical / immediate attention

BLUE/CYAN = informational / selected / neutral analytical state

Do not use colors merely for decoration.

Color must encode meaning.

Never make the entire dashboard red/yellow/green.

Normal operating state should visually remain calm.

An anomaly should attract attention because it is operationally important, not because the entire interface becomes visually aggressive.

NASA firing-room display research also supports minimizing distractions during normal operations, using muted tones, grouping information logically, and making alarms visually salient when necessary.

---

# 5. TYPOGRAPHY

Prioritize readability over visual style.

Use a clean professional sans-serif typeface.

Create clear hierarchy:

Mission title
→ section title
→ subsystem title
→ metric
→ supporting value
→ timestamp / metadata

Do not use futuristic display fonts.

Do not use tiny text simply to fit more information.

Do not compress everything into dense grids.

Breathing space is intentional.

---

# 6. MCC SHOULD EXIST INSIDE THE EXISTING APPLICATION

Add a top-level application area/tab called:

## MCC

Do not create an entirely separate application.

The MCC should feel like a natural operational module inside H.E.L.I.O.S.

Suggested primary navigation:

MCC

Inside MCC:

* Overview
* Crew Health
* Systems
* Environment
* Communications
* Timeline
* Reports
* Procedures

You may modify this structure if repository architecture or task analysis reveals a better organization.

Do not create tabs merely because they sound professional.

Every tab must have a distinct operational purpose.

---

# 7. MCC OVERVIEW

The Overview is the operator's first screen.

Its job is:

"What is happening across the mission right now?"

Do NOT attempt to show every telemetry parameter.

Show only decision-relevant information.

Recommended structure:

## HEADER

Mission Control Center

Mission:
Artemis Health Monitoring

Mission phase:
Lunar Transit / dynamically derived from application state

Elapsed mission time

Current UTC

Overall mission state

Example:

NOMINAL

The actual values must come from application state where available.

Do not hardcode fake operational values into production logic.

---

# 8. ACTIVE EVENTS

Create a prominent Active Events area.

Show:

* critical events
* warnings
* advisories
* event count
* priority
* timestamp
* affected crew/system
* concise description
* acknowledgement state
* current state
* trend direction where meaningful

Example:

CRITICAL
CREW-02
Cardiovascular anomaly

HR +31.7% above personal baseline

03:12 ago

Do not show a meaningless "AI detected anomaly" message.

Show the evidence.

Clicking an event must take the operator into its investigation context.

---

# 9. EVENT PRIORITY MODEL

Create a consistent event hierarchy.

Suggested:

CRITICAL
Immediate attention required.

WARNING
Condition requires investigation or monitoring.

ADVISORY
Useful operational information.

NOMINAL
No action required.

Do not invent arbitrary priority labels.

Implement the event engine so thresholds and priority logic are centralized and explainable.

Document where each threshold comes from.

---

# 10. MISSION AND CREW SYNOPTIC

Create a compact mission-level schematic.

Show relationships between:

SPACECRAFT
|
+-- CREW
|
+-- ENVIRONMENT
|
+-- POWER
|
+-- COMMUNICATIONS
|
+-- NAVIGATION
|
+-- LIFE SUPPORT

Represent state visually.

Example:

SPACECRAFT
NOMINAL

CREW
ATTENTION

ENVIRONMENT
NOMINAL

POWER
NOMINAL

The schematic should communicate system state at a glance.

Do not create a decorative spacecraft illustration.

Use simple operational symbols and relationships.

---

# 11. CREW HEALTH OVERVIEW

Show all crew members together.

Each crew member should have:

* identifier
* role
* overall state
* HR
* SpO2
* respiration
* temperature
* relevant workload/activity context
* deviation from personal baseline

Example:

CREW-02
AT RISK

HR 108 bpm
Baseline 82
+31.7%

SpO2 96%
Baseline 98
-2.0%

Respiration 18/min
Baseline 14
+28.6%

Temperature 37.1°C
Baseline 36.4°C
+0.3°C

Do not make every value equally visually prominent.

The abnormal parameter should naturally attract attention.

---

# 12. PERSONAL BASELINE

Personal baseline is extremely important.

Whenever scientifically justified data exists, show:

CURRENT
PERSONAL BASELINE
DEVIATION

Do not only compare against generic population thresholds.

Example:

HR
108
Baseline 82
+31.7%

Make the distinction between:

* absolute threshold
* personal baseline deviation
* rate of change
* statistical anomaly

clear.

Do not imply that deviation from baseline alone means medical danger.

---

# 13. TREND ANALYSIS

For important parameters, show trend rather than isolated values.

A useful trend should answer:

* where the value was
* where it is now
* direction
* rate of change
* relevant threshold
* baseline
* selected time window

Support:

1h
6h
12h
24h
Custom

Do not add chart types simply for visual variety.

Use line charts when time-series interpretation is relevant.

Use reference lines for:

* personal baseline
* warning threshold
* critical threshold

Do not use excessive gridlines.

---

# 14. CORRELATION ENGINE

This is one of the most important MCC capabilities.

When an anomaly is selected, correlate relevant signals within an appropriate temporal window.

Example:

14:32:10
HR ↑

14:32:14
Respiration ↑

14:32:18
SpO2 ↓

14:32:25
Workload ↑

14:32:31
Temperature ↑

Then show:

Possible linked factors:

* physical exertion
* environmental condition
* stress response

The system must distinguish:

OBSERVED DATA

from

INFERRED RELATIONSHIP

from

POSSIBLE EXPLANATION

Do not state correlation as proven causation.

Use language such as:

"Associated signal"

"Possible contributing factor"

"Temporally correlated"

"Requires operator review"

Never:

"Cause confirmed"

unless the underlying system actually proves it.

---

# 15. WHY IS THIS FLAGGED?

Every important automated alert should have an explanation.

Example:

WHY IS THIS FLAGGED?

✓ HR 31.7% above personal baseline
✓ Increasing for 8 minutes
✓ Respiration increased simultaneously
✓ Pattern associated with increased workload

Confidence:

92%

The confidence value must only be displayed if the underlying algorithm actually produces a meaningful confidence measure.

Do not invent confidence percentages.

If no validated confidence model exists, show:

"Evidence strength: Moderate"

or an equivalent explainable state derived from the actual system.

---

# 16. RISK TRAJECTORY

Do not only say:

"Risk: High"

Show trajectory:

STABLE
IMPROVING
WORSENING
UNCERTAIN

Where technically justified, calculate:

* rate of change
* threshold proximity
* estimated time to threshold
* uncertainty

Example:

Estimated time to warning threshold:
~11 min

Estimated time to critical threshold:
~18 min

These values must be calculated from actual data.

Never hardcode countdowns.

If a reliable estimate cannot be produced:

"Time-to-threshold unavailable"

Do not guess.

---

# 17. DECISION SUPPORT

The MCC must help the human operator evaluate possible actions.

Example:

DECISION SUPPORT

Current condition:
Moderate cardiovascular anomaly

Risk trajectory:
Increasing

Suggested actions to evaluate:

1. Request crew status check
2. Review current activity/workload
3. Check environmental conditions
4. Review applicable procedure

The system must NEVER imply that the AI has authority to make the final mission decision.

Use:

"Suggested actions to evaluate"

not:

"AI decision"

The operator remains in control.

For each recommendation, provide:

* evidence
* rationale
* expected purpose
* possible consequence
* relevant procedure/source

NASA-STD-3001 decision-support guidance specifically emphasizes human authority over decision aids and requires explanations, rationales, and consequences for potential actions.

---

# 18. PROCEDURE LINKING

If an event maps to a procedure, show:

Relevant Procedure

Procedure ID
Procedure title
Current applicable step
Prerequisites
Warnings
Expected outcome

Provide a clear:

OPEN PROCEDURE

interaction.

Do not fabricate NASA procedures.

If a real procedure does not exist in the repository, clearly label a demo procedure as:

SIMULATED PROCEDURE

or

DEMONSTRATION PROCEDURE

---

# 19. SYSTEMS TAB

Create a dedicated Systems view.

Possible categories:

Life Support
Thermal Control
Power
Communications
Navigation & Guidance
Propulsion

For each subsystem show:

* current state
* key parameters
* active faults
* recent changes
* trend
* dependency
* event history

Provide a subsystem-level synoptic.

Do not dump hundreds of telemetry values on screen.

Allow drill-down.

---

# 20. ENVIRONMENT TAB

Show mission environment information relevant to crew and vehicle safety.

Potential parameters:

* cabin pressure
* cabin temperature
* CO2
* O2
* humidity
* radiation
* ventilation
* environmental control status
* consumables

Show:

Current
Baseline / expected range
Warning
Critical
Trend
Rate of change
Estimated remaining margin where justified

For CO2, use the actual NASA source-backed threshold implemented by the system.

NASA OCHMO's CO2 technical brief states that NASA-STD-3001 Volume 2 requires the average one-hour cabin CO2 partial pressure to be no more than 3 mmHg.

Do not convert this into an arbitrary "3.0 alarm" without preserving units and context.

---

# 21. CONSUMABLES

If supported by the repository, show:

O2 remaining
CO2 scrubbing capacity
Water remaining
Consumable rate
Estimated remaining duration
Margin

The system must distinguish:

Measured quantity

from

Calculated estimate

from

Mission planning assumption

Do not present an estimate as a sensor measurement.

NASA's OCHMO technical brief gives example crew metabolic loads from HIDH, including approximately 0.82 kg/day O2 consumption and 1.04 kg/day CO2 output for the example standard mission day with exercise.

Do NOT blindly hardcode "0.84 kg O2/day" or "1.00 kg CO2/day" as universal constants.

Use source-backed values and document the assumptions.

---

# 22. COMMUNICATIONS TAB

This is important for deep-space mission scenarios.

Show:

* spacecraft-to-ground link status
* signal state
* link quality
* latency
* estimated one-way light time
* expected two-way delay
* communication blackout windows
* last received telemetry timestamp
* data freshness
* packet/data loss where available

Clearly distinguish:

LIGHT-TIME LATENCY

from

ACTUAL NETWORK / PROCESSING LATENCY.

Use:

latency = distance / speed of light

only for propagation-time calculation.

NASA's Mars Relay Network documentation gives an approximate Earth-Mars one-way light-time range of about 3 minutes at 54.6 million km to about 22.4 minutes at 400.2 million km.

Do not describe these values as network latency.

---

# 23. DATA FRESHNESS

Every critical live-data area should make stale data obvious.

Show:

LIVE
DELAYED
STALE
MISSING

Example:

Telemetry
LIVE
10 Hz

or:

Last update:
14:32:10 UTC
Age:
2.1 sec

Never allow an old value to visually appear equivalent to a live value.

---

# 24. TIMELINE TAB

Create a mission timeline that combines:

* crew activities
* mission phase
* anomalies
* warnings
* system events
* commands
* environmental changes
* communication events

The operator should be able to answer:

"What happened immediately before this anomaly?"

Support event selection and synchronized highlighting.

---

# 25. EVENT INVESTIGATION VIEW

Selecting an event should open a deeper analytical workspace.

Structure:

EVENT HEADER

Event ID
Priority
Time
Affected entity
Current state

CURRENT SIGNALS

TREND ANALYSIS

BASELINE COMPARISON

CORRELATED SIGNALS

MISSION CONTEXT

POSSIBLE FACTORS

RISK TRAJECTORY

EVIDENCE

DECISION SUPPORT

PROCEDURES

EVENT HISTORY

This is the place for detail.

Do not put all of this on the Overview screen.

---

# 26. REPORTS TAB

Create concise operational reports.

Possible reports:

Mission Health Summary
Crew Health Summary
Anomaly Summary
System Health Summary
Environmental Summary
Communication Summary
Event Timeline

Reports should be generated from actual application data.

Include:

* timestamp
* source
* calculations
* detected events
* important trends
* operator acknowledgements
* recommendations generated
* uncertainty / limitations

---

# 27. DATA PROVENANCE

This is mandatory.

Every important calculated metric should have traceability.

For example:

Metric:
Arrhythmia Risk Factor

Source:
computational_biomarkers.py

Input:
K+
ECG-derived parameters

Reference:
[documented source]

Last calculated:
timestamp

The operator should be able to inspect:

Where did this number come from?

Do not create unexplained AI metrics.

---

# 28. SCIENTIFIC MODEL AUDIT

Before implementing or exposing:

PRI
ARF
EPI
TRM
Moran PSI
QTc
any other biomarker

inspect the actual implementation in:

`computational_biomarkers.py`

Determine:

* formula
* input variables
* units
* assumptions
* threshold
* source
* validation status
* whether it is a research calculation, simulation metric, or established operational measure

Do not call something "NASA validated" unless the repository contains evidence supporting that claim.

Do not call a formula "peer reviewed" without a documented source.

Do not silently modify scientific formulas to make the UI work.

If a model is experimental, label it:

RESEARCH MODEL

SIMULATION MODEL

or

EXPERIMENTAL INDICATOR

as appropriate.

---

# 29. OSDR DATA HANDLING

Use NASA Open Science Data Repository data responsibly.

Relevant datasets include:

OSD-575
SpaceX Inspiration4 Blood Serum Metabolic Panel and Immune/Cardiac Cytokine Arrays

OSD-569
Whole Blood Measurements from the SpaceX Inspiration4 Mission

The OSDR documentation identifies these as Inspiration4 research studies involving pre/post-flight biological samples and laboratory measurements.

Do NOT represent these research samples as real-time live astronaut telemetry.

If the application combines OSDR-derived information with simulated telemetry, make the distinction explicit:

NASA RESEARCH DATA

SIMULATED TELEMETRY

DERIVED MODEL

LIVE APPLICATION STREAM

This distinction is extremely important for scientific credibility.

---

# 30. TELEMETRY STREAM

Inspect:

`astronaut_telemetry_stream.csv`

and

`generate_telemetry_stream.py`

Determine whether the stream is:

* raw
* simulated
* generated
* derived
* replayed

Display its actual status accurately.

If it is a simulation/replay, say so internally in the documentation and appropriately in the UI where necessary.

Do not imply that simulated data is live NASA telemetry.

---

# 31. BASELINE DATA

Inspect:

`nasa_astronaut_baselines.json`

Verify:

* source
* structure
* crew mapping
* units
* statistical representation
* validity
* whether the values represent real individual astronaut measurements or application-calibrated/simulated baselines

Do not label a baseline "NASA calibrated" without evidence.

Use:

PERSONAL BASELINE

APPLICATION BASELINE

or

REFERENCE BASELINE

according to provenance.

---

# 32. AUTOMATION TRANSPARENCY

Every automated analysis should expose:

* automation state
* data freshness
* input signals
* calculation/model
* result
* rationale
* uncertainty
* limitation

Use human-readable explanations.

Avoid anthropomorphic language.

Never say:

"I think..."

"I noticed..."

"I decided..."

Use:

"System detected..."

"Analysis indicates..."

"Pattern observed..."

"Possible contributing factor..."

---

# 33. OPERATOR CONTROL

The MCC is decision support.

The human operator remains responsible for operational decisions.

Do not automatically:

* issue spacecraft commands
* modify mission state
* change thresholds
* initiate emergency procedures
* override crew decisions

unless the existing application explicitly implements an authorized command workflow.

If command functionality exists, clearly show:

COMMAND SOURCE
Human
Automated
Crew
Remote

and command state:

Pending
Authorized
Executing
Completed
Rejected
Failed

---

# 34. COLOR AND ACCESSIBILITY

Do not rely on color alone.

Every state should have at least two indicators:

Color + text

or

Color + icon

or

Color + pattern/state marker

Example:

● NOMINAL

▲ WARNING

● CRITICAL

Do not make all text colored.

Use neutral text for normal information.

Use red only when attention is actually required.

---

# 35. ANIMATION

Use animation only when it improves situational awareness.

Good:

* subtle live-data updates
* selected-event transitions
* state-change indication
* controlled alert attention

Bad:

* glowing cards
* constant pulsing
* moving backgrounds
* spinning planets
* animated gradients
* decorative particles

The normal dashboard should feel calm.

An abnormal condition should create intentional visual priority.

---

# 36. RESPONSIVE DESIGN

The application must remain usable across:

* large desktop
* mission-control display
* laptop
* tablet

Do not simply shrink the desktop dashboard.

Create sensible information prioritization.

Critical information remains visible.

Secondary information can collapse or move into drill-down areas.

---

# 37. INTERACTION MODEL

Use progressive disclosure.

Level 1:

Mission state

Level 2:

Subsystem / crew state

Level 3:

Anomaly

Level 4:

Evidence

Level 5:

Detailed analysis

Level 6:

Procedure / decision support

This prevents the operator from becoming lost in information.

---

# 38. DASHBOARD DENSITY

Prefer:

fewer meaningful elements

over

many impressive elements.

Every card must have a purpose.

If two panels communicate the same information, merge them.

If a graph cannot support an operational question, remove it.

If a metric does not affect awareness or decision-making, hide it behind drill-down.

---

# 39. NO FAKE DATA

During development, use realistic demonstration data only where necessary.

Clearly distinguish:

REAL NASA RESEARCH DATA

APPLICATION DATA

SIMULATED DATA

DEMONSTRATION DATA

Do not fabricate scientific validation.

Do not fabricate NASA procedures.

Do not fabricate NASA operational thresholds.

Do not fabricate mission status.

Do not fabricate sensor confidence.

If something is unavailable, display:

Unavailable

Not calculated

Insufficient data

rather than inventing a value.

---

# 40. ERROR AND UNCERTAINTY HANDLING

The MCC must explicitly handle:

* missing telemetry
* stale telemetry
* sensor disagreement
* model failure
* insufficient data
* invalid units
* calculation failure
* communication delay
* conflicting signals

Example:

MODEL STATUS
INSUFFICIENT DATA

Reason:
Required ECG signal unavailable.

Do not generate an alert from an incomplete calculation without telling the operator.

---

# 41. DOCUMENTATION REQUIREMENTS

Antigravity must create or update documentation as part of the implementation.

Do not only write code.

Create a clear MCC documentation structure appropriate to the repository.

At minimum document:

## MCC Architecture

How MCC fits into H.E.L.I.O.S.

## Data Flow

Telemetry
→ processing
→ models
→ anomaly detection
→ correlation
→ decision support
→ UI

## Data Provenance

Source of every important dataset.

## Scientific Models

Formula
Inputs
Units
Assumptions
Reference
Validation status

## Alert Logic

How priorities are generated.

## Baseline Logic

How baseline deviation is calculated.

## Correlation Logic

How related signals are identified.

## Risk Logic

How trajectory and threshold proximity are calculated.

## Decision Support

How recommendations are generated and explained.

## UI Information Architecture

Purpose of every MCC screen.

## Human Factors

Why the interface is structured this way.

## Limitations

What the system cannot reliably determine.

## Simulation vs Real Data

Explicitly document which data is simulated, derived, research-based, or live.

## Verification

Document tests performed.

---

# 42. TESTING

Before considering MCC complete, test:

DATA

* telemetry ingestion
* timestamps
* units
* missing values
* stale values

CALCULATIONS

* biomarker calculations
* baseline deviations
* thresholds
* trend calculations
* risk trajectory

ALERTS

* warning
* critical
* advisory
* recovery
* acknowledgement

UI

* navigation
* drill-down
* event selection
* responsive behavior
* readable typography
* color accessibility
* keyboard interaction where appropriate

FAILURE STATES

* missing telemetry
* disconnected stream
* unavailable model
* insufficient data
* communication delay

Do not mark the feature complete simply because the screen renders.

---

# 43. SELF-REVIEW BEFORE FINALIZING

Before declaring the MCC finished, independently review the implementation as if you were a Mission Control operator.

Ask:

Can I understand mission state within 5 seconds?

Can I find the most important active event immediately?

Can I understand what changed?

Can I compare current value against baseline?

Can I see the trend?

Can I understand why the system flagged it?

Can I see related signals?

Can I distinguish observed evidence from inference?

Can I understand the risk trajectory?

Can I see what actions may be worth evaluating?

Can I find the relevant procedure?

Can I determine whether the data is live, delayed, simulated, or stale?

Can I determine where an important metric came from?

Can I remain the final decision maker?

If any answer is no, improve the interface.

---

# 44. DESIGN DECISION AUTHORITY

Do NOT wait for instructions about every component.

Inspect the repository.

Understand the existing architecture.

Identify what already exists.

Reuse existing components where appropriate.

Choose the appropriate frontend architecture.

Choose the appropriate state/data flow.

Choose sensible layouts.

Choose the number of panels.

Choose which information belongs on each screen.

Choose appropriate visualization types.

Choose progressive disclosure.

Choose the appropriate implementation path.

However, every decision must follow this priority:

1. Operational usefulness
2. Human factors
3. Scientific correctness
4. Data provenance
5. Readability
6. Reliability
7. Maintainability
8. Visual polish

Visual impressiveness is last.

---

# 45. FINAL PRODUCT CHARACTER

The finished MCC should feel like:

A calm, professional, human-centered mission operations system where an analyst can understand a developing situation without mentally reconstructing the entire event from dozens of telemetry panels.

It should NOT feel like:

"AI made a cool NASA dashboard."

It should feel like:

"A real operator could understand this system quickly."

The interface should be visually quiet when the mission is nominal and become visually informative only when operational attention is required.

Every element should earn its place.

Every number should have meaning.

Every alert should have evidence.

Every recommendation should have rationale.

Every calculation should have provenance.

Every uncertainty should be visible.

The system should support the operator, not replace the operator.

---

# 46. REQUIRED IMPLEMENTATION APPROACH

Do this in stages:

STAGE 1
Inspect repository architecture and existing MCC-related functionality.

STAGE 2
Audit datasets, telemetry, baselines, calculations, thresholds, and provenance.

STAGE 3
Create the MCC information architecture.

STAGE 4
Implement the Overview.

STAGE 5
Implement Crew Health and Event Investigation.

STAGE 6
Implement Systems and Environment.

STAGE 7
Implement Communications and Timeline.

STAGE 8
Implement Reports and Procedures.

STAGE 9
Connect real application data and models.

STAGE 10
Implement loading, stale, missing-data, error, and uncertainty states.

STAGE 11
Test calculations and interactions.

STAGE 12
Perform human-factors and visual review.

STAGE 13
Update documentation.

STAGE 14
Remove unnecessary UI.

Do not stop after creating visually attractive screens.

The final implementation must be functional, connected to the repository, explainable, documented, and testable.

---

# 47. IMPORTANT SCIENTIFIC REFERENCE BASIS

Use the following authoritative sources as the design and evidence foundation:

NASA Human Integration Design Handbook (HIDH)

NASA-STD-3001 Volume 2

NASA Display Standard / Appendix F

NASA Human-Centered Design of Next-Generation Telemetry Displays for Moon and Mars Exploration Missions

NASA OCHMO Carbon Dioxide Technical Brief

NASA Open Science Data Repository, SpaceX Inspiration4 studies including OSD-569 and OSD-575

NASA Mars Relay Network / communication light-time references

Use current official NASA documentation wherever available.

Do not copy NASA's visual identity or claim that this is an actual NASA operational system.

This is a research/demo implementation inspired by NASA human-factors and mission-control principles.

---

# FINAL INSTRUCTION

Do not blindly implement everything written above as separate cards.

Treat this document as an operational design intent.

Inspect the repository.

Analyze the available data.

Determine which features are actually supported.

Choose the cleanest implementation.

If two features duplicate each other, merge them.

If a requested metric is scientifically unsupported, do not fake it. Document the limitation and choose a defensible alternative.

If a feature requires data that does not exist, create the architecture for it but clearly represent its unavailable state rather than fabricating data.

If a better information architecture emerges from the repository, use it.

The final result must be:

MINIMAL
CALM
BREATHABLE
OPERATIONAL
SCIENTIFICALLY TRACEABLE
HUMAN-CENTERED
FUNCTIONAL
RESPONSIVE
EXPLAINABLE
MAINTAINABLE

The goal is not to build the most visually impressive dashboard.

The goal is to build the dashboard that allows a trained mission-control analyst to understand a developing situation and make an informed decision with the least unnecessary cognitive effort.
