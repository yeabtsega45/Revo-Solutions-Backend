// const verifyToken = require("../middlewares/verifyToken");
const workController = require("express").Router();
const multer = require("multer");
const db = require("../config/db");

// image upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "public/images");
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  },
});

const upload = multer({
  storage: storage,
});

// Create Work
workController.post("/create", (req, res) => {
  const {
    image,
    client,
    tags,
    description,
    introImage,
    categories,
    largeImages,
    smallImages,
  } = req.body;

  const sql = `INSERT INTO works (image, client, tags, description, introImage) VALUES (?, ?, ?, ?, ?)`;

  db.query(
    sql,
    [image, client, tags, description, introImage],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });

      const workId = result.insertId;

      // Insert categories
      categories.forEach((category) => {
        db.query(
          `INSERT INTO categories (work_id, category_name) VALUES (?, ?)`,
          [workId, category]
        );
      });

      // Insert large images
      largeImages.forEach((img) => {
        db.query(`INSERT INTO large_images (work_id, src) VALUES (?, ?)`, [
          workId,
          img.src,
        ]);
      });

      // Insert small images
      smallImages.forEach((img) => {
        db.query(`INSERT INTO small_images (work_id, src) VALUES (?, ?)`, [
          workId,
          img.src,
        ]);
      });

      res.json({ message: "Work added successfully", workId });
    }
  );
});

module.exports = workController;
