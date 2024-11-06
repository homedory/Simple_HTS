const express = require("express");
const router = express.Router();
const sql_connection = require("../db");

const util = require('util');
const query = util.promisify(sql_connection.query).bind(sql_connection);

router.get("/", (req, res) => {
    res.render("signupPage");
});

router.post("/", async (req, res) => {
    const { userId, password, firstName, lastName, phoneNumber, email, address, zipCode, birthDate, accountPassword } = req.body;

    try {
        let results = await query(`SELECT * FROM user WHERE user_id = ?`,[userId]);
        if (results.length > 0) {
            return res.redirect(`/signup?status=id_duplicate`);
        }
    
        const currentDateTime = new Date().toISOString().slice(0, 19).replace('T', ' ');
        
        results = await query(`
            INSERT INTO 
            user(user_id, password, first_name, last_name, phone_number, email, address, zip_code, date_of_birth, status, create_at)
            VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [userId, password, firstName, lastName, phoneNumber, email, address, zipCode, birthDate, 'ACTIVE', currentDateTime]
        );

        results = await query(`
            INSERT INTO
            account(user_id, password, account_balance, created_at)
            VALUES(?, ?, ?, ?)`,
            [userId, password, 0, currentDateTime]
        );

        res.redirect(`/login`);
    }
    catch(error) {
        console.error("DB error:", error);
        res.redirect(`/signup?status=fail`);
    }
});

module.exports = router;