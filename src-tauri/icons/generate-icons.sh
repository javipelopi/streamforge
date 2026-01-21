#!/bin/bash

# Icon generation script for StreamForge
# Generates: tray icons, Windows icon, macOS squircle icon
#
# Requirements:
# - ImageMagick 7+ (magick command)
# - iconutil (macOS built-in)
#
# Source files needed in ./source/:
# - color_sf.png: Color logo with transparent background (1080x1080)
# - white_sf.png: White bg with transparent logo cutout (1080x1080)

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SOURCE_DIR="$SCRIPT_DIR/source"
OUTPUT_DIR="$SCRIPT_DIR"

COLOR_SOURCE="$SOURCE_DIR/color_sf.png"
WHITE_SOURCE="$SOURCE_DIR/white_sf.png"

echo "=== StreamForge Icon Generator ==="
echo "Source directory: $SOURCE_DIR"
echo "Output directory: $OUTPUT_DIR"

# Check sources exist
if [ ! -f "$COLOR_SOURCE" ]; then
    echo "ERROR: Missing $COLOR_SOURCE"
    exit 1
fi

if [ ! -f "$WHITE_SOURCE" ]; then
    echo "ERROR: Missing $WHITE_SOURCE"
    exit 1
fi

# ===========================================
# 1. GENERATE TRAY ICONS
# ===========================================
echo ""
echo "=== Generating Tray Icons ==="

# Create WHITE tray icons (for dark tray/menubar on Windows/Linux)
echo "Creating white tray icons..."

magick "$WHITE_SOURCE" -resize 22x22 "$OUTPUT_DIR/tray-icon.png"
magick "$WHITE_SOURCE" -resize 44x44 "$OUTPUT_DIR/tray-icon@2x.png"
magick "$WHITE_SOURCE" -resize 16x16 "$OUTPUT_DIR/tray-icon-16.png"
magick "$WHITE_SOURCE" -resize 24x24 "$OUTPUT_DIR/tray-icon-24.png"

echo "Created: tray-icon.png, tray-icon@2x.png, tray-icon-16.png, tray-icon-24.png"

# Create BLACK template icons for macOS (system auto-adapts to light/dark)
# macOS will show white on dark menubar, black on light menubar
echo "Creating black template icons (for macOS auto-adapt)..."

magick "$WHITE_SOURCE" \
    -fill black -colorize 100 \
    -resize 22x22 \
    "$OUTPUT_DIR/tray-iconTemplate.png"

magick "$WHITE_SOURCE" \
    -fill black -colorize 100 \
    -resize 44x44 \
    "$OUTPUT_DIR/tray-iconTemplate@2x.png"

echo "Created: tray-iconTemplate.png, tray-iconTemplate@2x.png"

# ===========================================
# 2. GENERATE APP ICONS (various sizes)
# ===========================================
echo ""
echo "=== Generating App Icons ==="

# Use color_sf_filled (has play button filled white for better visibility)
COLOR_FILLED="$SOURCE_DIR/color_sf_filled.png"

if [ ! -f "$COLOR_FILLED" ]; then
    echo "ERROR: Missing $COLOR_FILLED"
    exit 1
fi

# Color icon with white-filled play button for all sizes
for size in 16 24 32 48 64 128 256 512 1024; do
    output_name="${size}x${size}.png"
    if [ $size -eq 256 ]; then
        output_name="128x128@2x.png"
    elif [ $size -eq 1024 ]; then
        output_name="icon-1024.png"
    fi

    magick "$COLOR_FILLED" -resize ${size}x${size} -alpha on -colorspace sRGB -depth 8 +dither "PNG32:$OUTPUT_DIR/$output_name"
    echo "Created: $output_name"
done

# ===========================================
# 3. GENERATE WINDOWS .ICO
# ===========================================
echo ""
echo "=== Generating Windows Icon ==="

# Use color_sf_filled.png which has play button filled with white
# (inner holes opaque, outer background transparent)
COLOR_FILLED="$SOURCE_DIR/color_sf_filled.png"

if [ ! -f "$COLOR_FILLED" ]; then
    echo "ERROR: Missing $COLOR_FILLED"
    echo "Please create this file manually with the play button filled white"
    exit 1
fi

# Create ICO with multiple sizes (16, 24, 32, 48, 64, 128, 256)
magick "$COLOR_FILLED" \
    \( -clone 0 -resize 16x16 \) \
    \( -clone 0 -resize 24x24 \) \
    \( -clone 0 -resize 32x32 \) \
    \( -clone 0 -resize 48x48 \) \
    \( -clone 0 -resize 64x64 \) \
    \( -clone 0 -resize 128x128 \) \
    \( -clone 0 -resize 256x256 \) \
    -delete 0 \
    "$OUTPUT_DIR/icon.ico"

echo "Created: icon.ico (with white-filled play button)"

# ===========================================
# 4. GENERATE macOS .ICNS (SQUIRCLE)
# ===========================================
echo ""
echo "=== Generating macOS Icon (Squircle) ==="

# Create temporary iconset directory
ICONSET_DIR="$OUTPUT_DIR/icon.iconset"
rm -rf "$ICONSET_DIR"
mkdir -p "$ICONSET_DIR"

# macOS icon sizes with squircle background (80% size with padding)
create_macos_icon() {
    local size=$1
    local suffix=$2
    local output="$ICONSET_DIR/icon_${size}x${size}${suffix}.png"

    # Squircle should be ~80% of icon size, centered with padding
    local squircle_size=$(echo "$size * 0.80" | bc | cut -d. -f1)
    local padding=$(echo "($size - $squircle_size) / 2" | bc)
    local logo_size=$(echo "$squircle_size * 0.75" | bc | cut -d. -f1)
    local corner_radius=$(echo "$squircle_size * 0.223" | bc | cut -d. -f1)

    # Create transparent canvas with centered WHITE squircle
    magick -size ${size}x${size} xc:none \
        -fill white \
        -draw "roundrectangle $padding,$padding,$((padding + squircle_size - 1)),$((padding + squircle_size - 1)),$corner_radius,$corner_radius" \
        \( "$COLOR_FILLED" -resize ${logo_size}x${logo_size} \) \
        -gravity center -composite \
        -alpha on -colorspace sRGB -depth 8 +dither \
        "PNG32:$output"

    echo "Created: icon_${size}x${size}${suffix}.png"
}

# Generate all required sizes for macOS iconset
create_macos_icon 16 ""
create_macos_icon 32 "@2x"
create_macos_icon 32 ""
create_macos_icon 64 "@2x"
create_macos_icon 128 ""
create_macos_icon 256 "@2x"
create_macos_icon 256 ""
create_macos_icon 512 "@2x"
create_macos_icon 512 ""
create_macos_icon 1024 "@2x"

# Convert iconset to icns
iconutil -c icns "$ICONSET_DIR" -o "$OUTPUT_DIR/icon.icns"
echo "Created: icon.icns"

# Clean up iconset directory
rm -rf "$ICONSET_DIR"

# ===========================================
# 5. COPY TO PUBLIC FOLDER
# ===========================================
echo ""
echo "=== Copying to public folder ==="
cp "$OUTPUT_DIR/32x32.png" "$SCRIPT_DIR/../../public/icons/32x32.png"
echo "Copied: public/icons/32x32.png"

echo ""
echo "=== Icon generation complete! ==="
