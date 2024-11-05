const express = require("express");
const router = express.Router();
const sql_connection = require("../db");

router.get("/", (req, res) => {
    res.render("signupPage");
});

router.post("/", (req, res) => {
    const {userID, userPassword} = req.body;
    sql_connection.query('SELECT * FROM user WHRE user_id = ?', [userID], (error, results, fields) => {
        if (error) throw error;

        if (results.length > 0) 
        {
            res.send("Same ID already exists");
        }
        else 
        {
            sql_connection.query('INSERT INTO user()', [], (error, results, fields) => {
                if (error) throw error;
                else
                {
                    res.send("signup success");
                }
            })
        }
    })
});

module.exports = router;