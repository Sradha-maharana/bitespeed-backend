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
    await pool.query(`
      CREATE TABLE IF NOT EXISTS Contact (
        id SERIAL PRIMARY KEY,
        phoneNumber VARCHAR(20),
        email VARCHAR(255),
        linkedId INT,
        linkPrecedence VARCHAR(20),
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        deletedAt TIMESTAMP
      );
    `);

    const existing = await pool.query(
      `SELECT * FROM Contact 
       WHERE email = $1 OR phoneNumber = $2`,
      [email, phoneNumber]
    );

    if (existing.rows.length === 0) {
      const insert = await pool.query(
        `INSERT INTO Contact (email, phoneNumber, linkPrecedence)
         VALUES ($1,$2,'primary') RETURNING *`,
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

    let primary =
      existing.rows.find(r => r.linkprecedence === "primary") ||
      existing.rows[0];

    const primaryId = primary.linkedid || primary.id;

    const exact = await pool.query(
      `SELECT * FROM Contact 
       WHERE email = $1 AND phoneNumber = $2`,
      [email, phoneNumber]
    );

    if (exact.rows.length === 0) {
      await pool.query(
        `INSERT INTO Contact 
         (email, phoneNumber, linkedId, linkPrecedence)
         VALUES ($1,$2,$3,'secondary')`,
        [email, phoneNumber, primaryId]
      );
    }

    const all = await pool.query(
      `SELECT * FROM Contact
       WHERE id = $1 OR linkedId = $1`,
      [primaryId]
    );

    const emails = [...new Set(all.rows.map(r => r.email).filter(Boolean))];
    const phones = [...new Set(all.rows.map(r => r.phonenumber).filter(Boolean))];

    const secondaryIds = all.rows
      .filter(r => r.linkprecedence === "secondary")
      .map(r => r.id);

    return res.json({
      contact: {
        primaryContactId: primaryId,
        emails,
        phoneNumbers: phones,
        secondaryContactIds: secondaryIds
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(process.env.PORT || 3000, () => {
  console.log("Server running");
});