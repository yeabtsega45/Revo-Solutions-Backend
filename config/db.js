const mysql = require("mysql2");
const dotenv = require("dotenv").config();

const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
});

db.getConnection((err) => {
  if (err) {
    console.log(err);
  } else {
    console.log("Database connected successfully!");
  }
});

module.exports = db;
