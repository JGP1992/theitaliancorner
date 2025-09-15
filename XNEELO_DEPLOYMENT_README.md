# Stocktake App - xneelo Deployment Guide

## Prerequisites
- xneelo VPS or Node.js-enabled hosting plan
- MySQL database (xneelo provides this)
- SSH access to your server
- Domain/subdomain configured

## Step 1: Database Setup
1. Log into your xneelo control panel
2. Create a new MySQL database
3. Note down the database credentials:
   - Database name
   - Username
   - Password
   - Host (usually localhost)

## Step 2: Upload Files
Upload your entire project to your xneelo server:

```bash
# Using SCP/SFTP
scp -r /Users/jarrydperry/Desktop/stocktake user@your-server.xneelo.co.za:~/stocktake/

# Or use your preferred FTP client
```

## Step 3: Server Configuration
SSH into your server and run:

```bash
cd ~/stocktake

# Set up environment variables
cp .env.example .env.local
nano .env.local  # Edit with your database credentials

# Run deployment script
./deploy.sh
```

## Step 4: Database Migration
```bash
# Push database schema
npx prisma db push

# Optional: Seed with sample data
npm run db:seed

# Optional: Seed minimal (no sample data)
# Prepares roles/permissions/packaging and can create a first admin if FIRST_ADMIN_* env vars are set
npm run db:seed:minimal
```

## Step 5: Process Management
```bash
# Install PM2 globally
npm install -g pm2

# Start the application
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save
pm2 startup

# Check status
pm2 status
pm2 logs stocktake
```

## Step 6: Web Server Configuration
Configure your web server to proxy requests to your Node.js app:

### Apache (.htaccess)
```apache
RewriteEngine On
RewriteRule ^$ http://127.0.0.1:3000/ [P,L]
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^(.*)$ http://127.0.0.1:3000/$1 [P,L]
```

### Nginx (if available)
```nginx
server {
    listen 80;
    server_name your-subdomain.xneelo.co.za;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Step 7: SSL Configuration
1. In xneelo control panel, enable SSL for your subdomain
2. Update your .env.local:
   ```
   NEXTAUTH_URL="https://your-subdomain.xneelo.co.za"
   ```

## Step 8: Access Your Application
Visit: `https://your-subdomain.xneelo.co.za`

## Troubleshooting

### Common Issues:
1. **Port already in use**: Change PORT in .env.local
2. **Database connection**: Verify DATABASE_URL format
3. **Memory issues**: Reduce PM2 instances or increase server resources
4. **Build failures**: Ensure Node.js version >= 18

### Logs:
```bash
# PM2 logs
pm2 logs stocktake

# Application logs
tail -f logs/combined.log
```

### Restart Application:
```bash
pm2 restart stocktake
```

## File Structure After Upload:
/home/username/
├── stocktake/
│   ├── app/
│   ├── components/
│   ├── lib/
│   ├── prisma/
│   ├── public/
│   ├── .env.local
│   ├── next.config.js
│   ├── package.json
│   ├── ecosystem.config.js
│   └── deploy.sh
└── logs/
