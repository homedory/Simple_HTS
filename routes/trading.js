const express = require("express");
const router = express.Router();
const sql_connection = require("../db");

const util = require('util');
const query = util.promisify(sql_connection.query).bind(sql_connection);
const { executeBuyOrder, executeSellOrder } = require("../transaction");


router.get("/buy-order/:stock_code", async (req, res) => {
    if (!req.session.userID) {
        return res.redirect("/login");
    }

    const stockCode = req.params.stock_code;

    try {
        // Get stock information
        const stockInfo = (await query(`SELECT * FROM stock WHERE stock_code = ? LIMIT 1`, [stockCode]))[0];
        const accountInfo = (await query(`SELECT * FROM account INNER JOIN user USING (user_id) WHERE user_id = ?`,[req.session.userID]))[0];
        const rateOfChange = ((stockInfo.current_price - stockInfo.closing_price) / stockInfo.closing_price * 100).toFixed(2);
        const accountBalance = accountInfo.account_balance;
        
        res.render("buyOrderPage", {stockInfo, rateOfChange, accountBalance });
        
    } catch (error) {
        console.error("DB error:", error);
        res.status(500).send("Server error");
    }

});

router.post("/buy-order/:stock_code", async (req, res) => {
    if (!req.session.userID) {
        return res.redirect("/login");
    }

    const accountInfo = (await query(`SELECT * FROM account INNER JOIN user USING (user_id) WHERE user_id = ?`,[req.session.userID]))[0];
    const stockCode = req.params.stock_code;
    const {price, priceType, quantity} = req.body;
    
    const currentDateTime = new Date().toISOString().slice(0, 19).replace('T', ' ');;
    
    try {
        let results;

        if (priceType == 'MARKET') {
            results = await query(`
                INSERT INTO \`order\` (account_id, stock_code, time, quantity, order_type, price_type, status)
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [accountInfo.account_id, stockCode, currentDateTime, quantity, 'BUY', priceType, 'UNEXECUTED']
            );
        }
        else if (priceType == 'LIMIT') {
            results = await query(`
                INSERT INTO \`order\` (account_id, stock_code, time, quantity, order_type, price_type, price, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [accountInfo.account_id, stockCode, currentDateTime, quantity, 'BUY', priceType, price, 'UNEXECUTED']
            );

            console.log("buy order: decrement balance", Number(price)*Number(quantity));
            // Decrement available balance
            const result = await query(`
                UPDATE account
                SET account_balance = account_balance - ?
                WHERE account_id = ?`,
                [Number(price)*Number(quantity), accountInfo.account_id]
            );

            console.log(result);

            const [balanceAfterUpdate] = await query(`SELECT account_balance FROM account WHERE account_id = ?`, [accountInfo.account_id]);
            console.log("Balance after update:", balanceAfterUpdate.account_balance);
        }

        await executeBuyOrder(results.insertId);

        res.redirect(`/trading/buy-order/${stockCode}?status=success`);

    } catch (error) {
        console.error("DB error:", error);
        res.redirect(`/trading/buy-order/${stockCode}?status=fail`);
    }
});

router.get("/sell-order/:stock_code", async (req, res) => {
    if (!req.session.userID) {
        return res.redirect("/login");
    }

    const stockCode = req.params.stock_code;

    try {
        // Get stock information
        const stockInfo = (await query(`SELECT * FROM stock WHERE stock_code = ? LIMIT 1`, [stockCode]))[0];
        const accountInfo = (await query(`SELECT * FROM account INNER JOIN user USING (user_id) WHERE user_id = ?`,[req.session.userID]))[0];
        const rateOfChange = ((stockInfo.current_price - stockInfo.closing_price) / stockInfo.closing_price * 100).toFixed(2);
        
        const ownedQuantity = Number((await query(
            `SELECT num_of_shares FROM has_stock WHERE account_id = ? AND stock_code = ?`,
             [accountInfo.account_id, stockCode]
        ))[0].num_of_shares);

        const orderedQuantity = Number((await query(`
            SELECT SUM(quantity) AS ordered_quantity 
            FROM \`order\`
            WHERE account_id = ? AND stock_code = ? AND order_type = ? AND status = ?`,
            [accountInfo.account_id, stockCode, 'SELL', 'UNEXECUTED']
        ))[0].ordered_quantity);

        const orderableQuantity = ownedQuantity - orderedQuantity;
        
        res.render("sellOrderPage", { stockInfo, rateOfChange, orderableQuantity });
        
    } catch (error) {
        console.error("DB error:", error);
        res.status(500).send("Server error");
    }
});

router.post("/sell-order/:stock_code", async (req, res) => {
    if (!req.session.userID) {
        return res.redirect("/login");
    }

    const accountInfo = (await query(`SELECT * FROM account INNER JOIN user USING (user_id) WHERE user_id = ?`,[req.session.userID]))[0];
    const stockCode = req.params.stock_code;
    const {price, priceType, quantity} = req.body;
    
    const currentDateTime = new Date().toISOString().slice(0, 19).replace('T', ' ');;

    try {
        let results;

        if (priceType == 'MARKET') {
            results = await query(`
                INSERT INTO \`order\` (account_id, stock_code, time, quantity, order_type, price_type, status)
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [accountInfo.account_id, stockCode, currentDateTime, quantity, 'SELL', priceType, 'UNEXECUTED']
            );
        }
        else if (priceType == 'LIMIT') {
            results = await query(`
                INSERT INTO \`order\` (account_id, stock_code, time, quantity, order_type, price_type, price, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [accountInfo.account_id, stockCode, currentDateTime, quantity, 'SELL', priceType, price, 'UNEXECUTED']
            );
        }

        await executeSellOrder(results.insertId);

        res.redirect(`/trading/sell-order/${stockCode}?status=success`);
    } catch (error) {
        console.error("DB error:", error);
        res.redirect(`/trading/sell-order/${stockCode}?status=fail`);
    }
});

module.exports = router;