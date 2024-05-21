require("dotenv").config();
const express = require("express");
const app = express();
require("./db");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const { createServer } = require("http");
const { Server } = require("socket.io");
const memo = require("./server/memo");
app.use(cors({
  origin: 'https://dev.borrowbe.com', // Allow all origins; specify array or regex for specific origins
  methods: ['GET', 'POST', 'PUT', 'DELETE'], // Specify allowed methods
  allowedHeaders: ['Content-Type', 'Authorization'], // Specify allowed headers
  credentials: true // If you need to allow credentials (cookies, authorization headers, etc.)
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
app.use(express.static(__dirname + "/build"));
app.use((req, res, next) => {
  req.country = req?.query?.country || "CA";
  next();
});

app.use("/api", require("./server/routers"));

httpServer.listen(process.env.PORT || 8080, () => {
  console.log(`server started on port ${process.env.PORT || 8080}`);
});

require("./server/Scheduled");
