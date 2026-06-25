module.exports = {

  apps: [
    {
      name: "bot",
      script: "npx",
      args: "tsx src/bot.ts",
      interpreter: "none",
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: "production"
      }
    }
  ]
};
