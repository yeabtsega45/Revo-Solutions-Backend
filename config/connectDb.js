const mysql = require("mysql2");

const connectDb = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

connectDb.connect((err) => {
  if (err) {
    console.log(err);
  } else {
    console.log("Database connected successfully!");
  }
});

module.exports = connectDb;
