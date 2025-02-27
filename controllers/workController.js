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

// Get all works
workController.get("/get/all", async (req, res) => {
  try {
    // Fetch all works
    const [works] = await db.promise().query("SELECT * FROM works");

    // Fetch categories, large images, and small images for each work
    const worksWithDetails = await Promise.all(
      works.map(async (work) => {
        const [categories] = await db
          .promise()
          .query("SELECT category_name FROM categories WHERE work_id = ?", [
            work.id,
          ]);

        const [largeImages] = await db
          .promise()
          .query("SELECT src FROM large_images WHERE work_id = ?", [work.id]);

        const [smallImages] = await db
          .promise()
          .query("SELECT src FROM small_images WHERE work_id = ?", [work.id]);

        return {
          ...work,
          categories: categories.map((c) => c.category_name),
          largeImages: largeImages.map((img) => img.src),
          smallImages: smallImages.map((img) => img.src),
        };
      })
    );

    res.json(worksWithDetails);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get a single work
workController.get("/get/:id", async (req, res) => {
  const { id } = req.params;

  try {
    // Fetch the work by ID
    const [work] = await db
      .promise()
      .query("SELECT * FROM works WHERE id = ?", [id]);

    if (work.length === 0) {
      return res.status(404).json({ error: "Work not found" });
    }

    // Fetch categories, large images, and small images
    const [categories] = await db
      .promise()
      .query("SELECT category_name FROM categories WHERE work_id = ?", [id]);

    const [largeImages] = await db
      .promise()
      .query("SELECT src FROM large_images WHERE work_id = ?", [id]);

    const [smallImages] = await db
      .promise()
      .query("SELECT src FROM small_images WHERE work_id = ?", [id]);

    const workData = {
      ...work[0],
      categories: categories.map((c) => c.category_name),
      largeImages: largeImages.map((img) => img.src),
      smallImages: smallImages.map((img) => img.src),
    };

    res.json(workData);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
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

// Update a work
workController.put("/edit/:id", async (req, res) => {
  const { id } = req.params;
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

  try {
    // Check if the work exists
    const [work] = await db
      .promise()
      .query("SELECT * FROM works WHERE id = ?", [id]);

    if (work.length === 0) {
      return res.status(404).json({ error: "Work not found" });
    }

    // Update work details
    await db
      .promise()
      .query(
        "UPDATE works SET image = ?, client = ?, tags = ?, description = ?, introImage = ? WHERE id = ?",
        [image, client, tags, description, introImage, id]
      );

    // Update categories
    await db.promise().query("DELETE FROM categories WHERE work_id = ?", [id]);
    if (categories && categories.length > 0) {
      const categoryValues = categories.map((category) => [id, category]);
      await db
        .promise()
        .query("INSERT INTO categories (work_id, category_name) VALUES ?", [
          categoryValues,
        ]);
    }

    // Update large images
    await db
      .promise()
      .query("DELETE FROM large_images WHERE work_id = ?", [id]);
    if (largeImages && largeImages.length > 0) {
      const largeImageValues = largeImages.map((img) => [id, img.src]);
      await db
        .promise()
        .query("INSERT INTO large_images (work_id, src) VALUES ?", [
          largeImageValues,
        ]);
    }

    // Update small images
    await db
      .promise()
      .query("DELETE FROM small_images WHERE work_id = ?", [id]);
    if (smallImages && smallImages.length > 0) {
      const smallImageValues = smallImages.map((img) => [id, img.src]);
      await db
        .promise()
        .query("INSERT INTO small_images (work_id, src) VALUES ?", [
          smallImageValues,
        ]);
    }

    res.json({ message: "Work updated successfully!" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a work
workController.delete("/delete/:id", async (req, res) => {
  const { id } = req.params;

  try {
    // Check if the work exists
    const [work] = await db
      .promise()
      .query("SELECT * FROM works WHERE id = ?", [id]);

    if (work.length === 0) {
      return res.status(404).json({ error: "Work not found" });
    }

    // Delete related data first (to maintain referential integrity)
    await db.promise().query("DELETE FROM categories WHERE work_id = ?", [id]);
    await db
      .promise()
      .query("DELETE FROM large_images WHERE work_id = ?", [id]);
    await db
      .promise()
      .query("DELETE FROM small_images WHERE work_id = ?", [id]);

    // Delete the work itself
    await db.promise().query("DELETE FROM works WHERE id = ?", [id]);

    res.json({ message: "Work deleted successfully!" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = workController;
