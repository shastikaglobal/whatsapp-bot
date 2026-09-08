import express from 'express';
import dotenv from 'dotenv';
dotenv.config();

const app = express();
const server = app.listen(3000, () => {
  console.log('Test 2 listening', server.address());
});
