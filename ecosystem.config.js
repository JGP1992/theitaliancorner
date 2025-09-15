module.exports = {
  apps: [{
    name: 'stocktake',
    script: 'npm',
    args: 'start',
    cwd: __dirname,
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      // DATABASE_URL, JWT_SECRET, and other secrets should be provided via the environment
      // or a process manager like PM2 ecosystem with --update-env.
    },
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
};
