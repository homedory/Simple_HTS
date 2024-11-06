const express = require("express");
const router = express.Router();
const sql_connection = require("../db");

const util = require('util');
const query = util.promisify(sql_connection.query).bind(sql_connection);

router.get("/", (req, res) => {
    if (!req.session.userID) {
        return res.redirect("/login");
    }

    res.render("userDeletePage");
});

router.post("/", async (req, res) => {
    if (!req.session.userID) {
        return res.redirect("/login");
    }

    const password = req.body.password;
    
    try {
        // Check password
        let results = await query(`
            SELECT * FROM user WHERE user_id = ? AND password = ?`,
            [req.session.userID, password]
        );

        if (results.length === 0) {
            res.render(`/user-delete?status=password_error`);
            return;
        }

        results = await query(`
            UPDATE user SET status = ? WHERE user_id = ?`,
            ['INACTIVE', req.session.userID]
        );

        res.redirect("/");
    }
    catch (error) {
        console.error("DB error:", error);
        res.redirect(`/user-delete?status=fail`);
    }
});

module.exports = router;