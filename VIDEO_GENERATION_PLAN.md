# QIRA Code Cards Video Generation Plan

## Overview
This document outlines the plan to transform the 9 placeholder code card images into 5-second looping videos using the LTI (Lighting-to-Video) model on the Spark infrastructure.

## Code Categories

The 9 code cards are organized into three thematic categories:

### Health and Vitality
1. **Focus**
2. **Restoration** (Recovery)
3. **Vitality** (Glow)
4. **Balance** (Hormone)

### Longevity and Sustainability
5. **Longevity**
6. **Sustainability**
7. **Harmony** (Weight)
8. **Growth** (Performance)
9. **Serenity** (Sleep)

## Video Generation Specifications

### Technical Requirements
- **Duration**: 5 seconds per video
- **Loop Type**: Seamless loop animation
- **Resolution**: 1024x1024 pixels (matching source images)
- **Frame Rate**: 24-30 FPS
- **Format**: MP4 (H.264/H.265 codec)

### Motion Characteristics
- Subtle parallax effects for depth
- Smooth transitions between visual elements
- Consistent lighting and color grading
- Responsive to code content and visual hierarchy

## Implementation Approach

### Phase 1: Code Analysis (Completed)
- Reviewed all 9 code card images
- Assessed visual elements and content hierarchy
- Validated image quality and compatibility

### Phase 2: Video Generation
- Process each code card through LTX video pipeline
- Apply category-specific visual parameters
- Generate optimized video outputs

## Quality Assurance

### Validation Criteria
- Visual coherence with original designs
- Smooth animation transitions
- Consistent color and lighting
- Optimal file sizes for web delivery

### Expected Deliverables
- 9 looping video files (one per code card)
- Video assets integrated with QIRA website
- Performance metrics documentation

## Next Steps

1. **Execute Video Generation Pipeline**
   - Deploy to Spark infrastructure
   - Process all 9 code cards
   - Validate output quality

2. **Integration**
   - Update website with video assets
   - Optimize for web performance
   - Documentation and testing

---

*Document generated: 2026-03-29*
*Status: Preparing for video generation execution*
