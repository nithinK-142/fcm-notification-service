require("dotenv").config();

module.exports = {
  apps: [
    {
      name: "notification-worker",
      script: "index.js",
      instances: 1,
      exec_mode: "fork",
      shutdown_with_message: true, // sends process.send('shutdown')
    },
  ]
};