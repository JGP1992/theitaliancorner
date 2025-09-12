#!/bin/bash

# Stocktake App Deployment Script for xneelo
# Run this on your xneelo server

echo "🚀 Starting Stocktake App Deployment..."

# Install Node.js dependencies
echo "📦 Installing dependencies..."
npm install

# Generate Prisma client
echo "🗄️ Generating Prisma client..."
npx prisma generate

# Build the application
echo "🔨 Building application..."
npm run build

# Create necessary directories
echo "📁 Creating directories..."
mkdir -p logs
mkdir -p uploads

echo "✅ Build completed!"
echo ""
echo "To start the application:"
echo "npm start"
echo ""
echo "Or for production with PM2:"
echo "npm install -g pm2"
echo "pm2 start npm --name stocktake -- start"
echo "pm2 save"
echo "pm2 startup"
