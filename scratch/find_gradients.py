with open(r'c:\Users\ZISHAN\OneDrive\Desktop\H.E.L.I.O.S\frontend\src\components\MissionControlView.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

import re

# Find sections: renderOverview, renderCrew, renderSystems
overview_idx = text.find('const renderOverview = () =>')
crew_idx = text.find('const renderCrew = () =>')
systems_idx = text.find('const renderSystems = () =>')
procedure_idx = text.find('const renderProcedures = () =>')

print(f"Overview pos: {overview_idx}, Crew pos: {crew_idx}, Systems pos: {systems_idx}")

def analyze_section(name, content):
    print(f"\n=== {name} ===")
    bg_matches = re.findall(r'background:\s*["\']([^"\']+)["\']', content)
    linear_grads = [b for b in bg_matches if 'linear-gradient' in b]
    print(f"Total backgrounds: {len(bg_matches)}, Gradients: {len(linear_grads)}")
    for g in set(linear_grads):
        print("  GRAD:", g[:100])
    
    # check border, boxShadow, card styles
    border_matches = re.findall(r'border:\s*["\']([^"\']+)["\']', content)
    print("  Unique borders:", list(set(border_matches))[:5])
    shadow_matches = re.findall(r'boxShadow:\s*["\']([^"\']+)["\']', content)
    print("  Unique shadows:", list(set(shadow_matches))[:5])

analyze_section("CREW", text[crew_idx:systems_idx])
analyze_section("SYSTEMS", text[systems_idx:procedure_idx])
analyze_section("OVERVIEW", text[overview_idx:crew_idx])
