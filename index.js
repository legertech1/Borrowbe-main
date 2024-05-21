require("dotenv").config();
const express = require("express");
const cors = require("cors");
const app = express();
app.use(cors({ origin: process.env.FRONTEND_URI }));
require("./db");
const cookieParser = require("cookie-parser");
const { createServer } = require("http");
const { Server } = require("socket.io");
const memo = require("./server/memo");
app.use(cors({
  origin: '*', // Specify the allowed origin
}));
const httpServer = createServer(app);
const io = new Server(httpServer, {
  maxHttpBufferSize: 15 * 1024 * 1024, // 15MB

  /* options */
});
module.exports = io;
io.use(require("./server/utils/authorizeWS"));
io.on("connection", require("./server/chat"));
app.use(express.json({ limit: "1000mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use((req, res, next) => {
  req.country = req?.query?.country || "CA";
  next();
});

app.use("/api", require("./server/routers"));

httpServer.listen(process.env.PORT || 8080, () => {
  console.log(`server started on port ${process.env.PORT || 8080}`);
});

require("./server/Scheduled");
