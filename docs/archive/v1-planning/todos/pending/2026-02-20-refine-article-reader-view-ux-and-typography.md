---
created: 2026-02-20T21:55:24.193Z
title: Refine article reader view UX and typography
area: ui
files:
  - frontend/src/components/reader/
---

## Problem

The article reader view needs a UX and visual polish pass across several dimensions:

- **Typography**: Review and refine font sizes, line heights, spacing, and hierarchy for comfortable long-form reading
- **Layout**: Evaluate content width, margins, padding, and overall structure
- **Reading experience**: Tune how quickly articles are marked as read (timing/scroll threshold), ensure smooth transitions
- **Button placement**: Review action button positions (bookmark, share, etc.), add a dedicated close button
- **Visual cohesion**: Align the reader view's look and feel with the settings pages — consistent use of panels, iconography, spacing patterns

## Solution

Audit the reader drawer/view components and iterate on each dimension. Use the settings pages as a visual reference for panel styling and iconography consistency. Consider reading-focused UX patterns (e.g., comfortable line length ~60-80 chars, adequate paragraph spacing, clear visual hierarchy).
