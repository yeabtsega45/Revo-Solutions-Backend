const userController = require("express").Router();
const db = require("../config/db");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

// Login user
userController.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    // Check if user exists
    const [user] = await db
      .promise()
      .query("SELECT * FROM users WHERE email = ?", [email]);

    if (user.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    // Compare password
    const validPassword = await bcrypt.compare(password, user[0].password);
    if (!validPassword) {
      return res.status(401).json({ error: "Invalid password" });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user[0].id, email: user[0].email },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({
      message: "Login successful",
      token,
      user: { id: user[0].id, name: user[0].name, email: user[0].email },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = userController;
