# Plate Detector Module

This directory contains configuration, parameters, and anchor specifications for the high-speed plate localization subsystem.

## Architecture
- **Stage 1**: Multi-scale aspect ratio contour bounding box extraction (supports single-line `2.0 - 7.5` and two-line double-decker `1.1 - 2.2`).
- **Stage 2**: Morphological TopHat/BlackHat contrast enhancement + Sobel X edge gradient analysis.
- **Stage 3**: Canny Edge dynamic bounding thresholding for high-contrast bumper plates.
- **Performance**: Sub-1ms execution on 640px downscaled frame buffers.
