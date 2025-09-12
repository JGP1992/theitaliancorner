#!/bin/bash

# Quick deployment package creator
echo "📦 Creating deployment package..."

# Create deployment directory
mkdir -p deployment

# Copy all necessary files
cp -r app deployment/
cp -r components deployment/
cp -r lib deployment/
cp -r prisma deployment/
cp -r public deployment/
cp package.json deployment/
cp next.config.js deployment/
cp ecosystem.config.js deployment/
cp deploy.sh deployment/
cp .env.example deployment/
cp XNEELO_DEPLOYMENT_README.md deployment/

# Create zip file
zip -r stocktake-deployment.zip deployment/

echo "✅ Deployment package created: stocktake-deployment.zip"
echo ""
echo "📤 Upload this file to your xneelo server and extract it"
echo "📖 Follow the instructions in XNEELO_DEPLOYMENT_README.md"
