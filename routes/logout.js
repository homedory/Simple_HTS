const express = require("express");
const router = express.Router();
const sql_connection = require("../db");

const util = require('util');
const query = util.promisify(sql_connection.query).bind(sql_connection);

router.get("/", (req, res) => {
    if (!req.session.userID) {
        return res.redirect("/");
    }

    req.session.destroy((err) => {
        if (err) {
            console.error("Failed to destroy session", err);
            return res.redirect("/");
        }
        
        res.redirect("/");
    });
});

module.exports = router;