const express = require("express");
const { Pool } = require("pg");
require("dotenv").config();

const app = express();
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

app.get("/", (req, res) => {
  res.send("Bitespeed API is running");
});

app.post("/identify", async (req, res) => {
  const { email, phoneNumber } = req.body;

  try {
    const existing = await pool.query(
      "SELECT * FROM Contact WHERE email = $1 OR phoneNumber = $2",
      [email, phoneNumber]
    );

    if (existing.rows.length === 0) {
      const insert = await pool.query(
        "INSERT INTO Contact (email, phoneNumber, linkedId, linkPrecedence) VALUES ($1,$2,NULL,'primary') RETURNING *",
        [email, phoneNumber]
      );

      return res.json({
        contact: {
          primaryContactId: insert.rows[0].id,
          emails: [email],
          phoneNumbers: [phoneNumber],
          secondaryContactIds: []
        }
      });
    }

    const primary = existing.rows[0];

    return res.json({
      contact: {
        primaryContactId: primary.id,
        emails: [primary.email],
        phoneNumbers: [primary.phonenumber],
        secondaryContactIds: []
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(3000, () => console.log("Server running on port 3000"));