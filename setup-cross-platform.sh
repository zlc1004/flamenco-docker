#!/bin/bash

# Flamenco Cross-Platform Setup Instructions
# =========================================

echo "Setting up Flamenco cross-platform workflow..."

# Create the projects directory
echo "Creating projects directory..."
mkdir -p shared-storage/projects

echo ""
echo "FLAMENCO CROSS-PLATFORM SETUP COMPLETE!"
echo ""
echo "┌─ WINDOWS USERS ─────────────────────────────────────┐"
echo "│                                                     │"
echo "│ 1. Create folder: C:/FlamencoProjects/              │"
echo "│ 2. Save ALL Blender projects in C:/FlamencoProjects/│"
echo "│ 3. Copy project files to this shared-storage/projects/│"
echo "│ 4. Submit jobs from Blender normally               │"
echo "│                                                     │"
echo "└─────────────────────────────────────────────────────┘"
echo ""
echo "Path Mapping:"
echo "  Windows: C:/FlamencoProjects/ → Linux: /mnt/shared/flamenco/projects/"
echo ""
echo "Example workflow:"
echo "  1. Save project: C:/FlamencoProjects/MyScene.blend"
echo "  2. Copy to host: ./shared-storage/projects/MyScene.blend"
echo "  3. Submit job from Windows Blender"
echo "  4. Flamenco automatically maps paths!"
echo ""
echo "Now restart containers:"
echo "  docker-compose down && docker-compose up -d"