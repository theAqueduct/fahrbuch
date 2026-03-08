#!/bin/bash

# Fahrbuch EAS Build Script
# This script sets up the environment and provides easy commands for EAS builds

# Set up Node.js path
export PATH="/opt/homebrew/Cellar/node@22/22.22.0/bin:$PATH"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}Fahrbuch EAS Build Helper${NC}"
echo "========================================"

# Check if user is logged in
if npx eas-cli whoami &>/dev/null; then
    USER=$(npx eas-cli whoami)
    echo -e "${GREEN}✓ Logged in as: $USER${NC}"
else
    echo -e "${YELLOW}⚠ Not logged in to Expo${NC}"
    echo "Please run: npx eas-cli login"
    exit 1
fi

# Function to show menu
show_menu() {
    echo ""
    echo "What would you like to do?"
    echo "1) Configure EAS project"
    echo "2) Build iOS (preview)"
    echo "3) Build Android (preview)"  
    echo "4) Build both platforms (preview)"
    echo "5) List builds"
    echo "6) Project info"
    echo "7) Exit"
    echo ""
}

# Function to build iOS
build_ios() {
    echo -e "${BLUE}Building iOS app for preview...${NC}"
    npx eas-cli build --platform ios --profile preview
}

# Function to build Android
build_android() {
    echo -e "${BLUE}Building Android app for preview...${NC}"
    npx eas-cli build --platform android --profile preview
}

# Function to build both
build_both() {
    echo -e "${BLUE}Building both iOS and Android apps for preview...${NC}"
    npx eas-cli build --platform all --profile preview
}

# Function to configure project
configure_project() {
    echo -e "${BLUE}Configuring EAS project...${NC}"
    npx eas-cli build:configure
}

# Function to list builds
list_builds() {
    echo -e "${BLUE}Listing recent builds...${NC}"
    npx eas-cli build:list
}

# Function to show project info
project_info() {
    echo -e "${BLUE}Project information:${NC}"
    npx eas-cli project:info
}

# Main menu loop
while true; do
    show_menu
    read -p "Enter your choice (1-7): " choice
    
    case $choice in
        1)
            configure_project
            ;;
        2)
            build_ios
            ;;
        3)
            build_android
            ;;
        4)
            build_both
            ;;
        5)
            list_builds
            ;;
        6)
            project_info
            ;;
        7)
            echo -e "${GREEN}Goodbye!${NC}"
            exit 0
            ;;
        *)
            echo -e "${RED}Invalid option. Please enter 1-7.${NC}"
            ;;
    esac
    
    echo ""
    read -p "Press Enter to continue..."
done