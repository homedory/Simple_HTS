const express = require("express");
const router = express.Router();
const sql_connection = require("../db"); 

router.get("/", (req, res) => {
    if (req.session.userID) {
        return res.redirect("/");
    }
    
    res.render("loginPage")
});

router.post("/", (req, res) => {
    const {userID, userPassword} = req.body;
    sql_connection.query(
        `SELECT * FROM user WHERE user_id = ? AND password = ? AND status = 'ACTIVE'`, 
        [userID, userPassword], 
        (error, results) => {
            if (error) throw error;
            
            if (results.length === 1) 
            {
                req.session.userID = results[0].user_id;
                res.redirect('/')
            }
            else
            {
                res.render("loginPage", {loginResult: 'fail'});
            }
    })
});

module.exports = router;