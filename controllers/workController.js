const workController = require("express").Router();
const multer = require("multer");
const db = require("../config/db");
const path = require("path");
const fs = require("fs");

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
    // Fetch all works ordered by the `order` column
    const [works] = await db
      .promise()
      .query("SELECT * FROM works ORDER BY `order` ASC");

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

    // Fetch categories
    const [categories] = await db
      .promise()
      .query("SELECT category_name FROM categories WHERE work_id = ?", [id]);

    // Fetch large and small images by order
    const [largeImages] = await db
      .promise()
      .query(
        "SELECT src FROM large_images WHERE work_id = ? ORDER BY `order` ASC",
        [id]
      );

    const [smallImages] = await db
      .promise()
      .query(
        "SELECT src FROM small_images WHERE work_id = ? ORDER BY `order` ASC",
        [id]
      );

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
workController.post(
  "/create",
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "introImage", maxCount: 1 },
    { name: "largeImages", maxCount: 2 },
    { name: "smallImages", maxCount: 8 },
  ]),
  (req, res) => {
    const { client, tags, description } = req.body;
    const categories = req.body.categories || [];

    // If categories is a single value, convert it to an array
    const categoriesArray = Array.isArray(categories)
      ? categories
      : [categories];

    // Get filenames from uploaded files
    const image = req.files.image ? req.files.image[0].filename : null;
    const introImage = req.files.introImage
      ? req.files.introImage[0].filename
      : null;

    const sql = `INSERT INTO works (image, client, tags, description, introImage) VALUES (?, ?, ?, ?, ?)`;

    db.query(
      sql,
      [image, client, tags, description, introImage],
      (err, result) => {
        if (err) return res.status(500).json({ error: err.message });

        const workId = result.insertId;

        // Insert categories
        categoriesArray.forEach((category) => {
          db.query(
            `INSERT INTO categories (work_id, category_name) VALUES (?, ?)`,
            [workId, category]
          );
        });

        // Insert large images
        if (req.files.largeImages) {
          req.files.largeImages.forEach((img) => {
            db.query(`INSERT INTO large_images (work_id, src) VALUES (?, ?)`, [
              workId,
              img.filename,
            ]);
          });
        }

        // Insert small images
        if (req.files.smallImages) {
          req.files.smallImages.forEach((img) => {
            db.query(`INSERT INTO small_images (work_id, src) VALUES (?, ?)`, [
              workId,
              img.filename,
            ]);
          });
        }

        res.json({ message: "Work added successfully", workId });
      }
    );
  }
);

// Update a work
workController.put(
  "/update/:id",
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "introImage", maxCount: 1 },
    { name: "largeImages", maxCount: 2 },
    { name: "smallImages", maxCount: 8 },
  ]),
  (req, res) => {
    const workId = req.params.id;
    const { client, tags, description } = req.body;
    const categories = req.body.categories || [];
    const categoriesArray = Array.isArray(categories)
      ? categories
      : [categories];

    // Get existing image filenames and their orders
    const existingSmallImages = req.body.existingSmallImages || [];
    const existingSmallImagesOrder = req.body.existingSmallImagesOrder || [];
    const existingLargeImages = req.body.existingLargeImages || [];
    const existingLargeImagesOrder = req.body.existingLargeImagesOrder || [];

    // Get new image orders
    const smallImagesOrder = req.body.smallImagesOrder || [];
    const largeImagesOrder = req.body.largeImagesOrder || [];

    // Get images to delete
    // Ensure deleted images are always arrays
    const smallImagesToDelete = Array.isArray(req.body.smallImagesToDelete)
      ? req.body.smallImagesToDelete
      : [req.body.smallImagesToDelete].filter(Boolean);
    const largeImagesToDelete = Array.isArray(req.body.largeImagesToDelete)
      ? req.body.largeImagesToDelete
      : [req.body.largeImagesToDelete].filter(Boolean);

    // Fetch existing images
    db.query(
      "SELECT image, introImage FROM works WHERE id = ?",
      [workId],
      (err, workResults) => {
        if (err) return res.status(500).json({ error: err.message });
        if (workResults.length === 0)
          return res.status(404).json({ error: "Work not found" });

        const work = workResults[0];
        const newImage = req.files.image
          ? req.files.image[0].filename
          : work.image;
        const newIntroImage = req.files.introImage
          ? req.files.introImage[0].filename
          : work.introImage;

        // Update work data
        db.query(
          "UPDATE works SET image = ?, client = ?, tags = ?, description = ?, introImage = ? WHERE id = ?",
          [newImage, client, tags, description, newIntroImage, workId],
          (err) => {
            if (err) return res.status(500).json({ error: err.message });

            // Update categories
            db.query(
              "DELETE FROM categories WHERE work_id = ?",
              [workId],
              (err) => {
                if (err) return res.status(500).json({ error: err.message });
                categoriesArray.forEach((category) => {
                  db.query(
                    "INSERT INTO categories (work_id, category_name) VALUES (?, ?)",
                    [workId, category]
                  );
                });
              }
            );

            // Update existing large images order
            existingLargeImages.forEach((filename, index) => {
              db.query(
                "UPDATE large_images SET `order` = ? WHERE work_id = ? AND src = ?",
                [existingLargeImagesOrder[index], workId, filename]
              );
            });

            // Insert new large images with order
            if (req.files.largeImages) {
              req.files.largeImages.forEach((img, index) => {
                db.query(
                  "INSERT INTO large_images (work_id, src, `order`) VALUES (?, ?, ?)",
                  [workId, img.filename, largeImagesOrder[index]]
                );
              });
            }

            // Update existing small images order
            existingSmallImages.forEach((filename, index) => {
              db.query(
                "UPDATE small_images SET `order` = ? WHERE work_id = ? AND src = ?",
                [existingSmallImagesOrder[index], workId, filename]
              );
            });

            // Insert new small images with order
            if (req.files.smallImages) {
              req.files.smallImages.forEach((img, index) => {
                db.query(
                  "INSERT INTO small_images (work_id, src, `order`) VALUES (?, ?, ?)",
                  [workId, img.filename, smallImagesOrder[index]]
                );
              });
            }

            // Delete replaced main images from filesystem
            [work.image, work.introImage].forEach((img) => {
              if (img && img !== newImage && img !== newIntroImage) {
                const imagePath = path.join(__dirname, "../public/images", img);
                fs.unlink(imagePath, (err) => {
                  if (err && err.code !== "ENOENT")
                    console.error("Error deleting image:", err);
                });
              }
            });

            // Delete images marked for deletion
            // Delete small images
            if (smallImagesToDelete.length > 0) {
              db.query(
                "DELETE FROM small_images WHERE work_id = ? AND src IN (?)",
                [workId, smallImagesToDelete]
              );

              smallImagesToDelete.forEach((img) => {
                const imagePath = path.join(__dirname, "../public/images", img);
                fs.unlink(imagePath, (err) => {
                  if (err && err.code !== "ENOENT")
                    console.error("Error deleting image:", err);
                });
              });
            }

            // Delete large images
            if (largeImagesToDelete.length > 0) {
              db.query(
                "DELETE FROM large_images WHERE work_id = ? AND src IN (?)",
                [workId, largeImagesToDelete]
              );

              largeImagesToDelete.forEach((img) => {
                const imagePath = path.join(__dirname, "../public/images", img);
                fs.unlink(imagePath, (err) => {
                  if (err && err.code !== "ENOENT")
                    console.error("Error deleting image:", err);
                });
              });
            }

            res.json({ message: "Work updated successfully" });
          }
        );
      }
    );
  }
);

// Delete Work by ID
workController.delete("/delete/:id", (req, res) => {
  const workId = req.params.id;

  // First, get all images associated with the work
  const getImagesSql = `SELECT image, introImage FROM works WHERE id = ?`;
  db.query(getImagesSql, [workId], (err, workResults) => {
    if (err) return res.status(500).json({ error: err.message });
    if (workResults.length === 0)
      return res.status(404).json({ error: "Work not found" });

    const work = workResults[0];

    // Get large images
    const getLargeImagesSql = `SELECT src FROM large_images WHERE work_id = ?`;
    db.query(getLargeImagesSql, [workId], (err, largeImagesResults) => {
      if (err) return res.status(500).json({ error: err.message });

      // Get small images
      const getSmallImagesSql = `SELECT src FROM small_images WHERE work_id = ?`;
      db.query(getSmallImagesSql, [workId], (err, smallImagesResults) => {
        if (err) return res.status(500).json({ error: err.message });

        // Collect all image filenames
        const images = [
          work.image,
          work.introImage,
          ...largeImagesResults.map((row) => row.src),
          ...smallImagesResults.map((row) => row.src),
        ].filter(Boolean);

        // Delete images from filesystem
        images.forEach((img) => {
          const imagePath = path.join(__dirname, "../public/images", img);
          fs.unlink(imagePath, (err) => {
            if (err && err.code !== "ENOENT") {
              console.error("Error deleting image:", err);
            }
          });
        });

        // Delete related records from the database
        const deleteCategoriesSql = `DELETE FROM categories WHERE work_id = ?`;
        db.query(deleteCategoriesSql, [workId], (err) => {
          if (err) return res.status(500).json({ error: err.message });

          const deleteLargeImagesSql = `DELETE FROM large_images WHERE work_id = ?`;
          db.query(deleteLargeImagesSql, [workId], (err) => {
            if (err) return res.status(500).json({ error: err.message });

            const deleteSmallImagesSql = `DELETE FROM small_images WHERE work_id = ?`;
            db.query(deleteSmallImagesSql, [workId], (err) => {
              if (err) return res.status(500).json({ error: err.message });

              // Finally, delete the work entry
              const deleteWorkSql = `DELETE FROM works WHERE id = ?`;
              db.query(deleteWorkSql, [workId], (err) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ message: "Work deleted successfully" });
              });
            });
          });
        });
      });
    });
  });
});

// update work order
workController.put("/reorder", async (req, res) => {
  const reorderedWorks = req.body;

  const connection = await db.promise().getConnection(); // ✅ Use promise-based connection

  try {
    await connection.beginTransaction();

    // Update each work's order in the database
    for (const work of reorderedWorks) {
      await connection.query("UPDATE works SET `order` = ? WHERE id = ?", [
        work.order,
        work.id,
      ]);
    }

    await connection.commit();
    connection.release();
    res.json({ message: "Works reordered successfully!" });
  } catch (error) {
    await connection.rollback();
    connection.release();
    console.error("Error updating order:", error);
    res.status(500).json({ error: "Failed to update order" });
  }
});

module.exports = workController;
