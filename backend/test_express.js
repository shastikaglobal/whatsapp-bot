import express from 'express';
const app = express();
const server = app.listen(3000, () => {
  console.log("TEST SERVER LISTENING", server.address());
});
