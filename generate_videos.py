#!/usr/bin/env python3
"""
QIRA Code Cards Video Generation Script
Generates 5-second looping videos from 9 code card images using LTX model
"""

import os
import json
from pathlib import Path
from dataclasses import dataclass
from typing import List, Dict, Optional

# Code card configurations
CODE_CONFIG = {
    "focus.jpg": {
        "category": "Health and Vitality",
        "theme": "Cognitive Performance",
        "motion_intensity": "moderate",
        "color_palette": "warm_neutral"
    },
    "glow.jpg": {
        "category": "Health and Vitality",
        "theme": "Radiant Energy",
        "motion_intensity": "high",
        "color_palette": "warm_glow"
    },
    "hormone.jpg": {
        "category": "Health and Vitality",
        "theme": "Biological Balance",
        "motion_intensity": "subtle",
        "color_palette": "balanced"
    },
    "longevity.jpg": {
        "category": "Longevity and Sustainability",
        "theme": "Sustainable Resilience",
        "motion_intensity": "gradual",
        "color_palette": "earth_tones"
    },
    "performance.jpg": {
        "category": "Longevity and Sustainability",
        "theme": "Optimized Growth",
        "motion_intensity": "dynamic",
        "color_palette": "vibrant"
    },
    "recovery.jpg": {
        "category": "Health and Vitality",
        "theme": "Restorative Process",
        "motion_intensity": "smooth",
        "color_palette": "restful"
    },
    "sleep.jpg": {
        "category": "Health and Vitality",
        "theme": "Rest and Recovery",
        "motion_intensity": "gentle",
        "color_palette": "calming"
    },
    "sustainability.jpg": {
        "category": "Longevity and Sustainability",
        "theme": "Environmental Harmony",
        "motion_intensity": "steady",
        "color_palette": "nature_inspired"
    },
    "weight.jpg": {
        "category": "Longevity and Sustainability",
        "theme": "Equilibrium",
        "motion_intensity": "balanced",
        "color_palette": "grounded"
    }
}

@dataclass
class VideoSpec:
    """Video generation specifications"""
    duration: int = 5
    fps: int = 30
    resolution: tuple = (1024, 1024)
    format: str = "mp4"
    codec: str = "h264"
    loop: bool = True

def load_code_configs(images_dir: Path) -> Dict[str, dict]:
    """Load configuration for each code card image"""
    configs = {}
    for image_file in images_dir.glob("*.jpg"):
        image_name = image_file.name
        if image_name in CODE_CONFIG:
            configs[image_name] = CODE_CONFIG[image_name]
            configs[image_name]["source_path"] = str(image_file)
            configs[image_name]["exists"] = image_file.exists()
        return configs

def generate_motion_sequence(config: dict) -> dict:
    """Generate motion sequence parameters based on config"""
    motion_params = {
        "focus": {"zoom_range": [0.9, 1.1], "pan_speed": "medium"},
        "glow": {"glow_pulse": True, "brightness_variation": 0.2},
        "hormone": {"wave_pattern": "sinusoidal", "flow_direction": "center_outward"},
        "longevity": {"growth_pattern": "organic", "fade_transitions": True},
        "performance": {"acceleration_curve": "ease_in_out", "dynamic_lighting": True},
        "recovery": {"rhythm_pattern": "breathing", "soft_transitions": True},
        "sleep": {"luminosity_cycle": "night_day", "calm_motions": True},
        "sustainability": {"stability_focus": True, "environmental_elements": True},
        "weight": {"balance_dynamics": True, "symmetrical_motion": True}
    }
    return motion_params.get(config["theme"], {})

def create_video_asset(image: dict) -> dict:
    """Create video asset metadata"""
    return {
        "name": image["theme"],
        "source_file": image["source_path"],
        "category": image["category"],
        "dimensions": "1024x1024",
        "format": "mp4",
        "status": "pending"
    }

def main():
    """Main execution function"""
    images_dir = Path("/Users/intellect/.openclaw/workspace-qira/qira-peptide-site/assets/codes")
    
    # Load configurations
    configs = load_code_configs(images_dir)
    print(f"Loaded configurations for {len(configs)} code cards")
    
    # Generate video specifications
    video_specs = {}
    for image_name, config in configs.items():
        video_specs[image_name] = {
            "image": create_video_asset(config),
            "motion": generate_motion_sequence(config),
            "specifications": VideoSpec()
        }
    
    # Display summary
    print("\n=== Video Generation Summary ===")
    for image_name, spec in video_specs.items():
        print(f"\n{image_name}:")
        print(f"  Category: {spec['image']['category']}")
        print(f"  Theme: {spec['image']['name']}")
        
    return video_specs

if __name__ == "__main__":
    specifications = main()
    print(f"\nTotal videos to generate: {len(specifications)}")
print(json.dumps(specifications, indent=2, default=str))
