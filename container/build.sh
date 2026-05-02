#!/bin/bash
# Build the BioClaw agent container image.
#
# Two-stage build:
#   1. Base image (Dockerfile)        — bio CLI tools + Node agent runner
#   2. Viz overlay (Dockerfile.viz)   — Python plotting libs + SSL CA path fix
#
# Both are tagged as bioclaw-agent:<tag> at the end.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

IMAGE_NAME="bioclaw-agent"
TAG="${1:-latest}"

echo "[1/2] Building base image: ${IMAGE_NAME}:${TAG} (Dockerfile)"
docker build -t "${IMAGE_NAME}:${TAG}" .

echo ""
echo "[2/2] Overlaying Python + SSL fix: ${IMAGE_NAME}:${TAG} (Dockerfile.viz)"
docker build -f Dockerfile.viz -t "${IMAGE_NAME}:${TAG}" .

echo ""
echo "Build complete!"
echo "Image: ${IMAGE_NAME}:${TAG}"
echo ""
echo "Test with:"
echo "  echo '{\"prompt\":\"What is 2+2?\",\"groupFolder\":\"test\",\"chatJid\":\"test@g.us\",\"isMain\":false}' | docker run -i ${IMAGE_NAME}:${TAG}"
