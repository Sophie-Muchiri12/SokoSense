"""Seed knowledge for the advisory RAG pipeline (Kenyan crop/disease facts).

Seeded as plain rows into the ``crops`` / ``diseases`` / ``crop_diseases``
tables by :func:`db.seed.seed_knowledge`. Also used verbatim as the
in-memory fallback when Postgres is not configured.
"""

from __future__ import annotations

# (crop, sci_name, crop_type, disease, severity, symptom, remedy, practice)
SEED_KNOWLEDGE: list[dict[str, str]] = [
    {
        "crop": "Maize", "sci_name": "Zea mays", "type": "Cereal",
        "disease": "Maize Rust (Puccinia sorghi)", "severity": "Moderate",
        "symptom": "Orange-brown pustules on leaves; premature leaf death",
        "remedy": "Resistant varieties (e.g. DUMA 43); early planting; fungicide (Mancozeb) at first sign; crop rotation with legumes",
        "practice": "Plant certified disease-free seeds; space rows 75cm apart for airflow; apply nitrogen in splits",
    },
    {
        "crop": "Maize", "sci_name": "Zea mays", "type": "Cereal",
        "disease": "Maize Lethal Necrosis (MLN)", "severity": "Severe",
        "symptom": "Yellow streaking, leaf necrosis, plant stunting, dead heart",
        "remedy": "No cure — uproot and burn; rotate with non-cereals for 2 seasons; control thrips and aphids",
        "practice": "Use MLN-free certified seeds (e.g. WE3109); avoid planting maize after maize",
    },
    {
        "crop": "Maize", "sci_name": "Zea mays", "type": "Cereal",
        "disease": "Fall Armyworm (Spodoptera frugiperda)", "severity": "Severe",
        "symptom": "Window-pane damage on leaves; frass (sawdust-like) near whorl; ragged feeding",
        "remedy": "Early detection; neem extract spray; Emamectin benzoate; push-pull farming (Desmodium + Napier grass)",
        "practice": "Scout fields weekly; intercropping with beans reduces infestation",
    },
    {
        "crop": "Maize", "sci_name": "Zea mays", "type": "Cereal",
        "disease": "Maize Streak Virus", "severity": "Moderate",
        "symptom": "Pale-green/yellow streaks along leaf veins; stunted growth",
        "remedy": "Control leafhoppers (vectors); use tolerant varieties (e.g. PIONEER 3253); rogue infected plants early",
        "practice": "Plant early in the season to avoid peak leafhopper populations",
    },
    {
        "crop": "Beans", "sci_name": "Phaseolus vulgaris", "type": "Legume",
        "disease": "Angular Leaf Spot", "severity": "Moderate",
        "symptom": "Grey-brown angular lesions on leaves; pod lesions; premature defoliation",
        "remedy": "Copper-based fungicides; crop rotation (2+ years); use resistant varieties (e.g. KAT X56)",
        "practice": "Avoid overhead irrigation; remove crop debris after harvest",
    },
    {
        "crop": "Beans", "sci_name": "Phaseolus vulgaris", "type": "Legume",
        "disease": "Bean Rust (Uromyces appendiculatus)", "severity": "Moderate",
        "symptom": "Small rust-brown pustules on underside of leaves; yellow halos",
        "remedy": "Fungicide (Mancozeb or Tebuconazole); resistant varieties; wide spacing",
        "practice": "Staking beans improves airflow and reduces rust severity",
    },
    {
        "crop": "Beans", "sci_name": "Phaseolus vulgaris", "type": "Legume",
        "disease": "Common Bacterial Blight", "severity": "Moderate",
        "symptom": "Water-soaked lesions on leaves that turn brown; pod lesions with yellowish ooze",
        "remedy": "Copper-based sprays; pathogen-free seeds; 3-year crop rotation; avoid working in wet fields",
        "practice": "Use certified disease-free bean seeds from KALRO",
    },
    {
        "crop": "Tomatoes", "sci_name": "Solanum lycopersicum", "type": "Vegetable",
        "disease": "Late Blight (Phytophthora infestans)", "severity": "Severe",
        "symptom": "Dark water-soaked lesions on leaves; white fungal growth under leaves; fruit rot",
        "remedy": "Metalaxyl + Mancozeb (Ridomil); remove infected plants; ensure good drainage",
        "practice": "Stake and prune tomatoes for air circulation; avoid overhead watering",
    },
    {
        "crop": "Tomatoes", "sci_name": "Solanum lycopersicum", "type": "Vegetable",
        "disease": "Tomato Yellow Leaf Curl Virus (TYLCV)", "severity": "Severe",
        "symptom": "Yellowing and curling of leaves upward; stunted growth; flower drop",
        "remedy": "Control whiteflies (vector); reflective mulch; resistant varieties (e.g. TYLER F1)",
        "practice": "Use 50-mesh insect netting for nursery; remove alternate hosts (e.g. black nightshade)",
    },
    {
        "crop": "Tomatoes", "sci_name": "Solanum lycopersicum", "type": "Vegetable",
        "disease": "Blossom End Rot", "severity": "Moderate",
        "symptom": "Dark sunken lesion on the blossom end of the fruit",
        "remedy": "Calcium foliar spray; consistent watering (drip irrigation); avoid ammonium-based nitrogen",
        "practice": "Mulch to retain soil moisture; test soil calcium before planting",
    },
    {
        "crop": "Potatoes", "sci_name": "Solanum tuberosum", "type": "Tuber",
        "disease": "Late Blight (Phytophthora infestans)", "severity": "Severe",
        "symptom": "Water-soaked lesions on leaves; white sporulation on underside; tuber rot",
        "remedy": "Metalaxyl + Mancozeb; certified disease-free seed potatoes; harvest tubers 2 weeks after vine kill",
        "practice": "Plant in well-drained soil; ridge up soil to protect tubers; avoid planting near tomatoes",
    },
    {
        "crop": "Potatoes", "sci_name": "Solanum tuberosum", "type": "Tuber",
        "disease": "Bacterial Wilt (Ralstonia solanacearum)", "severity": "Severe",
        "symptom": "Sudden wilting of lower leaves; brown vascular ring in tuber; milky ooze from cut stem",
        "remedy": "No chemical cure — remove and burn plants; rotate with non-solanaceous crops for 5+ years; solarize soil",
        "practice": "Use certified seed potatoes; avoid over-irrigation; disinfect tools with jik (1:9 dilution)",
    },
    {
        "crop": "Potatoes", "sci_name": "Solanum tuberosum", "type": "Tuber",
        "disease": "Potato Cyst Nematode (Globodera spp.)", "severity": "Moderate",
        "symptom": "Stunted yellow patches in field; poor root development; tiny golden cysts visible on roots",
        "remedy": "Crop rotation (non-host: maize, beans) for 5+ years; resistant varieties; trap cropping with Solanum sisymbriifolium",
        "practice": "Never plant potatoes in infested soil; clean machinery between fields",
    },
    {
        "crop": "Kale", "sci_name": "Brassica oleracea", "type": "Leafy Green",
        "disease": "Black Rot (Xanthomonas campestris)", "severity": "Moderate",
        "symptom": "V-shaped yellow lesions on leaf margins turning black; black veins",
        "remedy": "Copper-based sprays; remove infected leaves; 2-year rotation away from brassicas",
        "practice": "Use certified seed; avoid overhead watering; space plants for airflow",
    },
]
