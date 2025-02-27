const express = require("express");
const dotenv = require("dotenv").config();
const cors = require("cors");
const db = require("./config/db");
const workController = require("./controllers/workController");
const userController = require("./controllers/userController");

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  cors({
    origin: ["http://localhost:3000"],
    methods: ["POST", "GET", "PUT", "DELETE"],
    credentials: true,
  })
);
app.use("/images", express.static("public/images"));

app.use("/work", workController);
app.use("/user", userController);

app.listen(process.env.PORT || 5000, () =>
  console.log("server has been started successfully!")
);
